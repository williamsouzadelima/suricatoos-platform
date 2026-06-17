package controller

import (
	"errors"
	"testing"

	"github.com/sirupsen/logrus"
)

// The worker goroutines are detached, so an unrecovered panic in fn would crash the whole
// process. recoverPanic must convert a panic into an error, pass real errors through unchanged,
// and return nil on success.
func TestFlowWorkerRecoverPanic(t *testing.T) {
	fw := &flowWorker{logger: logrus.WithField("test", "flow")}

	t.Run("panic becomes an error instead of crashing", func(t *testing.T) {
		err := fw.recoverPanic("step", func() error { panic("boom") })
		if err == nil {
			t.Fatal("expected an error from a recovered panic, got nil")
		}
	})

	t.Run("nil-pointer deref panic is recovered", func(t *testing.T) {
		err := fw.recoverPanic("step", func() error {
			var p *int
			_ = *p // nil deref
			return nil
		})
		if err == nil {
			t.Fatal("expected an error from a recovered nil deref, got nil")
		}
	})

	t.Run("real error passes through", func(t *testing.T) {
		sentinel := errors.New("real error")
		if err := fw.recoverPanic("step", func() error { return sentinel }); !errors.Is(err, sentinel) {
			t.Fatalf("expected sentinel error, got %v", err)
		}
	})

	t.Run("success returns nil", func(t *testing.T) {
		if err := fw.recoverPanic("step", func() error { return nil }); err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
	})
}

func TestAssistantWorkerRecoverPanic(t *testing.T) {
	aw := &assistantWorker{logger: logrus.WithField("test", "assistant")}

	if err := aw.recoverPanic("perform", func() error { panic("boom") }); err == nil {
		t.Fatal("expected an error from a recovered panic, got nil")
	}
	sentinel := errors.New("real error")
	if err := aw.recoverPanic("perform", func() error { return sentinel }); !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got %v", err)
	}
	if err := aw.recoverPanic("perform", func() error { return nil }); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}
