#!/usr/bin/env python3
"""Correlate retained numeric WebRTC/video observations; never infer missing words."""
import argparse
import hashlib
import json
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text())


def analyze(rows, origin):
    video = [r for r in rows if r['stage'] == 'atlas_video_frame']
    scheduler = [r for r in rows if r['stage'] == 'browser_scheduler']
    counters = ('packetsLost', 'nackCount', 'retransmittedPacketsReceived', 'framesDropped',
                'freezeCount', 'totalFreezesDuration', 'concealmentEvents', 'concealedSamples',
                'silentConcealedSamples')
    streams = {stage: [r for r in rows if r['stage'] == stage and r.get('type') == 'inbound-rtp']
               for stage in ('atlas_return_video_rtc', 'atlas_return_audio_rtc', 'provider_rtc')}
    # This fixture contains one inbound stream per stage and no reconnect/reset.
    # Reject ambiguous report epochs rather than silently subtract unrelated counters.
    for stage, samples in streams.items():
        if any(a['at'] == b['at'] for a, b in zip(samples, samples[1:])):
            raise ValueError('ambiguous simultaneous streams: ' + stage)
        for key in ('framesDecoded', 'concealmentEvents', 'freezeCount'):
            values = [x[key] for x in samples if key in x]
            if any(b < a for a, b in zip(values, values[1:])):
                raise ValueError('counter reset: ' + stage + ':' + key)
    results = []
    for previous, current in zip(video, video[1:]):
        if current.get('displayGapMs', 0) <= 150:
            continue
        # The recorded callback wall time may follow expected display by a frame.
        # Include the actual missing display interval plus surrounding stats windows.
        lo, hi = previous['at'] - 1000, current['at'] + 1000
        windows = [s for s in scheduler if s['at'] >= previous['at'] and s['at'] - s['intervalMs'] <= current['at']]
        delta = {}
        for stage, samples in streams.items():
            selected = [s for s in samples if lo <= s['at'] <= hi]
            if len(selected) < 2:
                continue
            a, b = selected[0], selected[-1]
            delta[stage] = {'window_start_s': round((a['at'] - origin) / 1000, 3),
                            'window_end_s': round((b['at'] - origin) / 1000, 3),
                            **{k: round(b[k] - a[k], 6) for k in counters if k in a and k in b}}
        result = {
            'capture_s': round((current['at'] - origin) / 1000, 3),
            'display_gap_ms': current['displayGapMs'],
            'receive_gap_ms': round(current['receiveMs'] - previous['receiveMs'], 1),
            'rtp_timestamp_gap_ms': round(((current['rtpTimestamp'] - previous['rtpTimestamp']) % 2**32) / 90, 1),
            'presented_frames_increment': current['frames'] - previous['frames'],
            'decode_processing_ms': current['processingMs'],
            'scheduler_max_delay_ms': max((s['maxDelayMs'] for s in windows), default=None),
            'scheduler_longest_task_ms': max((s['longestTaskMs'] for s in windows), default=None),
            'scheduler_all_visible_running': all(s['visible'] and s['audioState'] == 'running' for s in windows) if windows else None,
            'counter_windows': delta,
        }
        # Labels describe evidence, not asserted causal roots.
        if result['scheduler_longest_task_ms'] and result['scheduler_longest_task_ms'] > 150 and result['presented_frames_increment'] > 1:
            result['evidence'] = 'callback gap coincides with main-thread long task and skipped callbacks'
        elif result['receive_gap_ms'] > 150 and result['scheduler_max_delay_ms'] is not None and result['scheduler_max_delay_ms'] < 50:
            result['evidence'] = 'received-frame gap without measured main-thread stall'
        else:
            result['evidence'] = 'unresolved presentation gap'
        results.append(result)
    return {'scope': 'Retained owned synthetic browser run; no current production health claim.',
            'origin_epoch_ms': origin, 'gaps_over_150ms': results,
            'provider_error_count': sum(r['stage'] == 'provider_error' for r in rows),
            'limits': ['One-second RTC counters localize increments to windows, not exact packets.',
                       'Receive timestamps cannot distinguish sender/model delay from transit/SFU delay.',
                       'A video gap and concealment do not prove a missing spoken word.',
                       'No packet loss increment does not exclude delayed packets.',
                       'RTP media timestamp gaps do not themselves prove discarded model frames.']}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('diagnostics'); p.add_argument('--origin', type=int, required=True)
    p.add_argument('--output', required=True)
    args = p.parse_args()
    result = analyze(read(args.diagnostics), args.origin)
    result['source_sha256'] = hashlib.sha256(Path(args.diagnostics).read_bytes()).hexdigest()
    Path(args.output).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
