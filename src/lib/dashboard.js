// dashboard.js — pure metric functions, ported verbatim from lib/cards.js
// (dashboardMetrics, paymentDashboardExtras). No I/O — just array math over
// already-fetched card objects.

export function dashboardMetrics(bc, cards) {
  const byStatus = {};
  bc.columns.forEach(col => { byStatus[col.id] = cards.filter(c => c.status === col.id).length; });
  const totalOpen = cards.filter(c => !bc.closedStatuses.includes(c.status)).length;
  return { totalOpen, totalAll: cards.length, byStatus };
}

export function paymentDashboardExtras(payCards) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let totalOutstandingAmount = 0;
  let paidThisMonthAmount = 0;
  let paidThisMonthCount = 0;

  payCards.forEach(c => {
    const inv = parseFloat(String(c.fields?.invoiceAmount || '0').replace(/[^0-9.]/g, '')) || 0;
    const paid = parseFloat(String(c.fields?.amountPaid || '0').replace(/[^0-9.]/g, '')) || 0;
    const isPaid = c.status === 'paid';
    const isClosed = c.status === 'closed';

    if (!isPaid && !isClosed) totalOutstandingAmount += (inv - paid);

    if (isPaid && c.fields?.datePaid && c.fields.datePaid.startsWith(thisMonth)) {
      paidThisMonthCount++;
      paidThisMonthAmount += paid || inv;
    }
  });

  const paymentsRequestedCount = payCards.filter(c => c.status === 'payment_requested').length;
  const paymentsPendingCount = payCards.filter(c => !['paid', 'closed'].includes(c.status)).length;

  return {
    totalOutstandingAmount: Math.round(totalOutstandingAmount * 100) / 100,
    paymentsRequestedCount,
    paymentsPendingCount,
    paidThisMonthCount,
    paidThisMonthAmount: Math.round(paidThisMonthAmount * 100) / 100
  };
}
