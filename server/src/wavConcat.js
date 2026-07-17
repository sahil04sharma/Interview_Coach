/**
 * Merge multiple WAV ArrayBuffers/Buffers into one WAV (PCM 16-bit assumed same format).
 * Falls back to first chunk if formats differ or parse fails.
 */
export function concatWavBuffers(buffers) {
  const parts = (buffers || []).filter(Boolean).map((b) => Buffer.from(b));
  if (!parts.length) return Buffer.alloc(0);
  if (parts.length === 1) return parts[0];

  try {
    const parsed = parts.map(parseWav);
    const fmt = parsed[0].fmt;
    for (const p of parsed) {
      if (
        p.fmt.audioFormat !== fmt.audioFormat ||
        p.fmt.numChannels !== fmt.numChannels ||
        p.fmt.sampleRate !== fmt.sampleRate ||
        p.fmt.bitsPerSample !== fmt.bitsPerSample
      ) {
        return parts[0];
      }
    }

    const pcm = Buffer.concat(parsed.map((p) => p.data));
    return encodeWav(pcm, fmt);
  } catch {
    return parts[0];
  }
}

function parseWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Not a WAV');
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(start),
        numChannels: buf.readUInt16LE(start + 2),
        sampleRate: buf.readUInt32LE(start + 4),
        byteRate: buf.readUInt32LE(start + 8),
        blockAlign: buf.readUInt16LE(start + 12),
        bitsPerSample: buf.readUInt16LE(start + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('Incomplete WAV');
  return { fmt, data };
}

function encodeWav(pcm, fmt) {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(fmt.audioFormat, 20);
  header.writeUInt16LE(fmt.numChannels, 22);
  header.writeUInt32LE(fmt.sampleRate, 24);
  header.writeUInt32LE(fmt.byteRate, 28);
  header.writeUInt16LE(fmt.blockAlign, 32);
  header.writeUInt16LE(fmt.bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}
