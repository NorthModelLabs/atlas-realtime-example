// Transcript completion order is independent of speech/response order.
// Keep item IDs so a late final cannot replace the current turn's captions.
export type Captions = {
  inputId: string; responseId: string; partial: string; user: string;
  assistant: string; speechActive: boolean;
};
export const emptyCaptions = (): Captions => ({inputId: "", responseId: "", partial: "", user: "", assistant: "", speechActive: false});
type Event = {
  type: string; item_id?: string; response_id?: string; delta?: string; transcript?: string;
  response?: {id?: string; status?: string};
};
export function captionEvent(state: Captions, event: Event): Captions {
  switch (event.type) {
    case "input_audio_buffer.speech_started":
      return {...state, inputId: event.item_id || "", responseId: "", partial: "", user: "", assistant: "", speechActive: true};
    case "input_audio_buffer.speech_stopped":
      return event.item_id === state.inputId ? {...state, speechActive: false} : state;
    case "conversation.item.input_audio_transcription.delta":
      return event.item_id === state.inputId ? {...state, partial: state.partial + (event.delta || "")} : state;
    case "conversation.item.input_audio_transcription.completed":
      return event.item_id === state.inputId ? {...state, partial: "", user: event.transcript?.trim() || ""} : state;
    case "conversation.item.input_audio_transcription.failed":
      return event.item_id === state.inputId ? {...state, partial: ""} : state;
    case "response.created":
      return {...state, responseId: event.response?.id || "", assistant: ""};
    case "response.output_audio_transcript.delta":
      return event.response_id === state.responseId && !!state.responseId
        ? {...state, assistant: state.assistant + (event.delta || "")} : state;
    case "response.output_audio_transcript.done":
      return event.response_id === state.responseId && !!state.responseId
        ? {...state, assistant: event.transcript?.trim() || state.assistant} : state;
    case "response.done":
      return event.response?.id === state.responseId && ["cancelled", "failed"].includes(event.response?.status || "")
        ? {...state, responseId: "", assistant: ""} : state;
    default: return state;
  }
}
