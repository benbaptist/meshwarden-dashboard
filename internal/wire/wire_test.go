package wire

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/benbaptist/meshwarden-dashboard/internal/pb"
)

func roundTrip(t *testing.T, m any) map[string]any {
	t.Helper()
	b, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestEncode(t *testing.T) {
	ch := uint64(7)
	b, err := Marshal(&pb.MessageRecord{Id: 1 << 40, ChannelIdx: 0, ChannelId: &ch, Text: "hi"})
	if err != nil {
		t.Fatal(err)
	}
	want := `"id":1099511627776`
	if !strings.Contains(string(b), want) {
		t.Errorf("64-bit ints must be numbers: %s", b)
	}

	got := roundTrip(t, Value(&pb.MessageRecord{}))
	if _, ok := got["channelId"]; ok {
		t.Errorf("unset optional field should be omitted: %v", got)
	}
	if got["channelIdx"] != float64(0) || got["text"] != "" {
		t.Errorf("zero-valued fields should be present: %v", got)
	}
}

func TestEncodeFloat32(t *testing.T) {
	b, err := Marshal(&pb.PingResponse{ElapsedMs: 12.5, Snr: []float32{5.1, -3.25}})
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"elapsedMs":12.5,"snr":[5.1,-3.25]}` {
		t.Errorf("got %s", b)
	}
}

func TestEncodeInlinesJSONFields(t *testing.T) {
	got := roundTrip(t, Value(&pb.DaemonEvent{Type: "advertisement", Ts: 5, PayloadJson: `{"name":"n"}`}))
	payload, ok := got["payloadJson"].(map[string]any)
	if !ok || payload["name"] != "n" {
		t.Errorf("payloadJson should be inlined: %v", got)
	}

	got = roundTrip(t, Value(&pb.CommandResult{Ok: true}))
	if v, ok := got["json"]; !ok || v != nil {
		t.Errorf("empty JSON field should be null: %v", got)
	}
}

func TestEncodeBytes(t *testing.T) {
	b, err := Marshal(&pb.RawCommandResponse{Frames: [][]byte{{1, 2, 3}}})
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"frames":["AQID"]}` {
		t.Errorf("got %s", b)
	}
}

func TestSetField(t *testing.T) {
	req := &pb.ListMessagesRequest{}
	for name, v := range map[string]string{"peer": "ab", "channelIdx": "0", "after_ts": "10", "limit": "5"} {
		if err := SetField(req, name, []string{v}); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
	if req.Peer != "ab" || req.ChannelIdx == nil || *req.ChannelIdx != 0 || req.AfterTs != 10 || req.Limit != 5 {
		t.Errorf("unexpected request: %v", req)
	}

	ev := &pb.StreamEventsRequest{}
	if err := SetField(ev, "types", []string{"a", "b"}); err != nil || len(ev.Types) != 2 {
		t.Errorf("repeated field: %v %v", ev.Types, err)
	}

	for _, tc := range []struct {
		name   string
		values []string
	}{
		{"nope", []string{"1"}},
		{"limit", []string{"x"}},
		{"limit", []string{"-1"}},
		{"limit", []string{"1", "2"}},
	} {
		if err := SetField(&pb.ListMessagesRequest{}, tc.name, tc.values); err == nil {
			t.Errorf("SetField(%s, %v) should fail", tc.name, tc.values)
		}
	}
}
