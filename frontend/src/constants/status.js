// Every value backend/app/routes/items.py writes to items.status.
export const STATUS = {
  PENDING: 'Pending',   // just created, enrichment running
  DONE: 'Done',         // enriched
  PARTIAL: 'Partial',   // scraped title/image, but the AI parse failed — still usable
  FAILED: 'Failed',     // nothing scraped, or enrichment crashed
};

// Rendered as the failed card. Checked first.
export const FAILURE_STATUSES = [STATUS.FAILED];

// Rendered as the normal card. Anything else is shown as pending.
export const READY_STATUSES = [STATUS.DONE, STATUS.PARTIAL];
