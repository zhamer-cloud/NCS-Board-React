export default {
  id: 'payment',
  label: 'Payment Board',
  description: 'Vendor payment tracking linked to appraisal and estimate jobs.',
  jobIdPrefix: 'PAY',
  navIcon: '💰',

  columns: [
    { id: 'estimate_completed',  label: 'Estimate Completed' },
    { id: 'waiting_invoice',     label: 'Waiting for Invoice' },
    { id: 'invoice_received',    label: 'Invoice Received' },
    { id: 'payment_requested',   label: 'Payment Requested' },
    { id: 'approved_for_payment',label: 'Approved for Payment' },
    { id: 'paid',                label: 'Paid' },
    { id: 'closed',              label: 'Closed' }
  ],

  closedStatuses: ['closed'],
  titleField: 'propertyAddress',
  swimlaneField: null,
  cardPreviewFields: ['vendorName', 'serviceType'],

  fieldGroups: [
    {
      id: 'payment_info',
      label: 'Payment Information',
      fields: [
        { key: 'propertyAddress',    label: 'Property Address',          type: 'text',     required: true },
        { key: 'linkedAppraisalId',  label: 'Linked Appraisal Job ID',   type: 'text',
          placeholder: 'APP-0001', hint: 'Enter the APP-XXXX ID from the Appraisal Board' },
        { key: 'linkedEstimateId',   label: 'Linked Estimate Job ID',    type: 'text',
          placeholder: 'EST-0001', hint: 'Enter the EST-XXXX ID from the Estimate Board (optional)' },
        { key: 'vendorName',         label: 'Vendor Name',               type: 'text' },
        { key: 'serviceType',        label: 'Service Type',              type: 'select',
          options: ['Roofing', 'Water Mitigation', 'Fire / Smoke', 'General Contracting',
                    'Electrical', 'Plumbing', 'HVAC', 'Contents', 'Other'] },
        { key: 'paymentMethod',      label: 'Payment Method',            type: 'select',
          options: ['Wise', 'Zelle', 'Bank Transfer', 'Check', 'Cash', 'Venmo', 'Quick Book', '661 Estimate', 'Western Union'] }
      ]
    },
    {
      id: 'amounts',
      label: 'Amounts & Dates',
      fields: [
        { key: 'invoiceAmount',       label: 'Invoice Amount',           type: 'currency' },
        { key: 'amountPaid',          label: 'Amount Paid',              type: 'currency' },
        { key: 'dateRequested',       label: 'Date Requested',           type: 'date' },
        { key: 'dateInvoiceReceived', label: 'Date Invoice Received',    type: 'date' },
        { key: 'datePaid',            label: 'Date Paid',                type: 'date' }
      ]
    }
  ],

  attachmentCategories: ['Invoices', 'Receipts', 'Other Documents']
};
