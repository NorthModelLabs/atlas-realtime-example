type Command = {type: string; [key: string]: unknown};

// response.create is already in flight before response.created arrives. Keep
// that interval busy, and wait for cancellation acknowledgement before starting
// a replacement response. All user messages stay in the conversation.
export class VoiceResponseQueue {
  private creating = false;
  private createEventId = "";
  private sequence = 0;
  private activeId = "";
  private pending = false;
  private cancelling = false;
  private superseded = new Set<string>();
  constructor(private send: (event: Command) => void) {}
  get busy() { return this.creating || !!this.activeId; }
  ignores(id: string | undefined) { return !!id && this.superseded.has(id); }

  submit(text: string) {
    this.send({type: "conversation.item.create", item: {type: "message", role: "user", content: [{type: "input_text", text}]}});
    this.pending = true;
    if (this.activeId) this.cancel();
    else if (!this.creating) {
      this.send({type: "output_audio_buffer.clear"});
      this.flush();
    }
  }
  created(id: string) {
    this.creating = false;
    this.createEventId = "";
    this.activeId = id;
    this.cancelling = false;
    if (this.pending) this.cancel();
  }
  done(id: string) {
    if (id !== this.activeId) return;
    this.activeId = "";
    this.cancelling = false;
    this.flush();
  }
  failed(eventId: string | undefined) {
    if (!eventId || eventId !== this.createEventId) return;
    this.creating = false;
    this.createEventId = "";
    this.pending = false;
  }
  private cancel() {
    if (this.cancelling) return;
    this.cancelling = true;
    this.superseded.add(this.activeId);
    if (this.superseded.size > 32) this.superseded.delete(this.superseded.values().next().value!);
    this.send({type: "response.cancel", response_id: this.activeId});
    this.send({type: "output_audio_buffer.clear"});
  }
  private flush() {
    if (!this.pending || this.busy) return;
    this.pending = false;
    this.creating = true;
    this.createEventId = `demo_response_${++this.sequence}`;
    this.send({type: "response.create", event_id: this.createEventId});
  }
}
