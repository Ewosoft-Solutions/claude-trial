'use client';

/* ============================================================
   What can be done with the invoice as a document

   These act on the finished artefact rather than on the composition, which is
   why they sit in the page header while "Update draft" and "Issue invoice" sit
   in the totals bar beside the figure they commit.

   The same bytes serve all three: previewing before issuing, saving a copy,
   and handing it to whatever the device can send with. Only the last two are
   recorded — a bursar checking a draft has shown it to nobody.
   ============================================================ */

import * as React from 'react';
import { toast } from 'sonner';
import { Download, Eye, Share2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import {
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';

import { authedFetch } from '@/lib/authed-fetch';

/** Whether this device can hand a file to another app. */
function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files })
  );
}

export function InvoiceDocumentActions({
  invoiceId,
  invoiceNumber,
  studentName,
  isDraft,
}: {
  invoiceId: string;
  invoiceNumber: string;
  studentName: string | null;
  isDraft: boolean;
}) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const filename = `${invoiceNumber}.pdf`;

  // An object URL is a handle to memory; dropping the drawer without revoking
  // it holds the whole document until the page goes away.
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchPdf = async (): Promise<Blob> => {
    const res = await authedFetch(`/api/finance/invoices/${invoiceId}/pdf`);
    if (!res.ok) throw new Error(`Could not render the invoice (${res.status})`);
    return res.blob();
  };

  /** Advisory — the OS never says whether the person went through with it. */
  const recordShare = (channel: 'download' | 'share-sheet') =>
    authedFetch(`/api/finance/invoices/${invoiceId}/shared`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel }),
    }).catch(() => {
      // A missing audit line must not look like a failed download to the
      // bursar; the document is already in their hands either way.
    });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onPreview = () =>
    run(async () => {
      const blob = await fetchPdf();
      setPreviewUrl(URL.createObjectURL(blob));
    });

  const onDownload = () =>
    run(async () => {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      void recordShare('download');
    });

  const onShare = () =>
    run(async () => {
      const blob = await fetchPdf();
      const file = new File([blob], filename, { type: 'application/pdf' });

      // File sharing is solid on mobile and patchy on the desktop, so the
      // button cannot assume it: without it, saving a copy is the same
      // outcome by a longer route.
      if (!canShareFiles([file])) {
        toast.message('Sharing is not available here — saving a copy instead');
        await onDownload();
        return;
      }

      try {
        await navigator.share({
          files: [file],
          title: invoiceNumber,
          text: studentName
            ? `Invoice ${invoiceNumber} for ${studentName}`
            : `Invoice ${invoiceNumber}`,
        });
        void recordShare('share-sheet');
      } catch (e) {
        // Dismissing the share sheet throws AbortError. Backing out is not a
        // failure and should not be reported as one.
        if ((e as Error)?.name !== 'AbortError') throw e;
      }
    });

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onPreview()}
        >
          <Eye aria-hidden /> Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onDownload()}
        >
          <Download aria-hidden /> Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onShare()}
        >
          <Share2 aria-hidden /> Share
        </Button>
      </div>

      <Sheet
        open={previewUrl !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewUrl(null);
        }}
      >
        <DrawerContent size="wide">
          <DrawerHeader className="gap-1.5">
            <DrawerTitle className="pr-8">{invoiceNumber}</DrawerTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              {isDraft
                ? 'How this bill will look. It is watermarked DRAFT until you issue it.'
                : 'The document as the family receives it.'}
            </SheetDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden bg-muted/30">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title={`Invoice ${invoiceNumber}`}
                className="size-full border-0"
              />
            ) : null}
          </div>
          <DrawerFooter className="flex-row justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewUrl(null)}
            >
              Close
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void onDownload()}>
              <Download aria-hidden /> Download
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Sheet>
    </>
  );
}
