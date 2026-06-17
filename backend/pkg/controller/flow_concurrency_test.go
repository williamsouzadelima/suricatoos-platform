package controller

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
)

// These tests validate the concurrency contract of the flow teardown rewrite:
//   - the worker drains its input channel and exits on ctx cancellation (NOT on a channel close);
//   - fw.input is never closed, so a concurrent PutInput-style send can never hit a closed channel;
//   - teardown (cancel + wg.Wait) is guarded by sync.Once, so any number of concurrent finishers
//     (FinishFlow vs the DeleteFlow resolver) collapse to a single run with no panic.
//
// They mirror the real primitives (ctx/cancel, wg, the select loop, finishOnce) without the heavy
// DB/docker/provider deps of a real flowWorker, and must be run under -race.

// stubWorker runs the same select shape as flowWorker.worker(): exit on ctx.Done(), otherwise
// drain inputs. It calls wg.Done() on exit, exactly like the real worker's `defer fw.wg.Done()`.
func runStubWorker(fw *flowWorker) {
	defer fw.wg.Done()
	for {
		select {
		case <-fw.ctx.Done():
			return
		case flin, ok := <-fw.input:
			if !ok {
				return
			}
			if flin.done != nil {
				flin.done <- nil // buffered cap-1, never blocks
			}
		}
	}
}

func TestFlowTeardownIdempotentUnderRace(t *testing.T) {
	for iter := 0; iter < 20; iter++ {
		ctx, cancel := context.WithCancel(context.Background())
		fw := &flowWorker{ctx: ctx, cancel: cancel, input: make(chan flowInput), wg: &sync.WaitGroup{}}
		fw.wg.Add(1)
		go runStubWorker(fw)

		var teardownRuns int32
		// teardown mirrors the core of Finish(): the cancel+wait guarded by finishOnce.
		teardown := func() {
			fw.finishOnce.Do(func() {
				atomic.AddInt32(&teardownRuns, 1)
				fw.cancel()
				fw.wg.Wait()
			})
		}

		var hammer sync.WaitGroup
		// Concurrent finishers (FinishFlow + the DeleteFlow resolver, plus extras).
		for i := 0; i < 16; i++ {
			hammer.Add(1)
			go func() { defer hammer.Done(); teardown() }()
		}
		// Concurrent PutInput-style senders racing the teardown — must never panic on a closed
		// channel (we never close fw.input) and must never block (ctx.Done() rescues the send).
		for i := 0; i < 16; i++ {
			hammer.Add(1)
			go func() {
				defer hammer.Done()
				select {
				case fw.input <- flowInput{input: "x", done: make(chan error, 1)}:
				case <-fw.ctx.Done():
				}
			}()
		}
		hammer.Wait()

		if got := atomic.LoadInt32(&teardownRuns); got != 1 {
			t.Fatalf("iter %d: teardown ran %d times, want exactly 1", iter, got)
		}
	}
}
