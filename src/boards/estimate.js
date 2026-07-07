export default {
  id: 'estimate',
  label: 'Estimate Board',
  description: 'Estimate requests linked to appraisal jobs.',
  jobIdPrefix: 'EST',   // cards get EST-0001, EST-0002...
  navIcon: '📋',

  columns: [
    { id: 'new_request',     label: 'New Estimate Request' },
    { id: 'assigned',        label: 'Assigned to Estimator' },
    { id: 'in_progress',     label: 'In Progress' },
    { id: 'received',        label: 'Estimate Received' },
    { id: 'needs_review',    label: 'Needs Review' },
    { id: 'under_revision',  label: 'Under Review / Revision' },
    { id: 'ready_to_send',   label: 'Ready to Send' },
    { id: 'sent_to_client',  label: 'Sent to Client' },
    { id: 'completed',       label: 'Completed' },
    { id: 'closed',          label: 'Closed' }
  ],

  closedStatuses: ['closed'],
  titleField: 'propertyAddress',
  swimlaneField: null,
  // jobId shown first; then these two extra fields on the card face.
  cardPreviewFields: ['linkedAppraisalId', 'estimateType'],

  fieldGroups: [
    {
      id: 'estimate_info',
      label: 'Estimate Information',
      fields: [
        { key: 'propertyAddress',    label: 'Property Address',         type: 'text', required: true },
        { key: 'linkedAppraisalId',  label: 'Linked Appraisal Job ID',  type: 'text',
          placeholder: 'APP-0001', hint: 'Enter the APP-XXXX ID from the Appraisal Board' },
        { key: 'jobCategory',        label: 'Job Category',             type: 'select',
          options: ['Roofing', 'Water Mitigation', 'Fire / Smoke', 'General Contracting', 'Contents', 'Other'] },
        { key: 'relatedToAppraisal', label: 'Related to Appraisal',     type: 'select',
          options: ['Yes', 'No'] },
        { key: 'estimateType',       label: 'Estimate Type',            type: 'text',
          placeholder: 'e.g. Xactimate, Contractor Bid, Supplement...' },
        { key: 'dateRequested',      label: 'Date Requested',           type: 'date' },
        { key: 'dateReceived',       label: 'Date Received',            type: 'date' }
      ]
    },
    {
      id: 'quick_links',
      label: 'Quick Links',
      fields: [
        { key: 'esxLink',         label: 'ESX Link',                    type: 'url',
          placeholder: 'https://...' },
        { key: 'pdfLink',         label: 'PDF Link',                    type: 'url',
          placeholder: 'https://...' },
        { key: 'docusketchLink',  label: 'DocuSketch / Matterport Link', type: 'url',
          placeholder: 'https://...' }
      ]
    }
  ],

  attachmentCategories: ['Photos', 'Files', 'Other Documents']
};
