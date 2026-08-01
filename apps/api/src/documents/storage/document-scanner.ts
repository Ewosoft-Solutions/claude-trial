import { Injectable } from '@nestjs/common';

export type ScanVerdict = 'clean' | 'infected' | 'error';

export interface ScanResult {
  verdict: ScanVerdict;
  detail?: string;
}

/**
 * Malware-scan port (F4 / ADR-08). Uploads are quarantined
 * (scan_status='pending') until a scan clears them; a download is refused for
 * anything not 'clean'. The real ClamAV/AV-vendor client slots in behind this
 * interface without touching call sites — the same indirection discipline as
 * the StorageProvider and LLM ports.
 */
export interface DocumentScanner {
  readonly scannerName: string;
  scan(bytes: Buffer): Promise<ScanResult>;
}

/** Nest injection token for the configured scanner. */
export const DOCUMENT_SCANNER = Symbol('DOCUMENT_SCANNER');

/**
 * Dev/default scanner: marks bytes clean unless they contain the industry
 * EICAR anti-malware test signature — so the quarantine path is provable in
 * tests and locally without a real virus.
 */
export const EICAR_TEST_SIGNATURE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

@Injectable()
export class HeuristicDocumentScanner implements DocumentScanner {
  readonly scannerName = 'dev-heuristic';

  async scan(bytes: Buffer): Promise<ScanResult> {
    const text = bytes.toString('latin1');
    if (text.includes(EICAR_TEST_SIGNATURE)) {
      return { verdict: 'infected', detail: 'EICAR test signature detected' };
    }
    return { verdict: 'clean' };
  }
}
