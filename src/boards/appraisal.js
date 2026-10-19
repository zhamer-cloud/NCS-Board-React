export default {
  id: 'appraisal',
  label: 'Appraisal Board',
  description: 'One card per appraisal job/property.',
  jobIdPrefix: 'APP',   // cards get APP-0001, APP-0002...
  navIcon: '⚖️',

  columns: [
    { id: 'new_lead',            label: 'New Lead' },
    { id: 'scheduled',           label: 'Scheduled' },
    { id: 'waiting_information', label: 'Waiting Information' },
    { id: 'in_review',           label: 'In Review' },
    { id: 'estimating',          label: 'Estimating' },
    { id: 'settlement_proposed', label: 'Settlement Proposed' },
    { id: 'submitted',           label: 'Submitted' },
    { id: 'waiting_response',    label: 'Waiting Response' },
    { id: 'completed',           label: 'Completed' },
    { id: 'closed',              label: 'Closed' }
  ],

  closedStatuses: ['closed'],
  titleField: 'propertyAddress',
  swimlaneField: null,
  // jobId is always shown first on the card face (rendered by board.js),
  // then these extra fields below it.
  cardPreviewFields: ['clientInsured', 'claimNumber'],

  fieldGroups: [
    {
      id: 'job',
      label: 'Job Information',
      fields: [
        { key: 'propertyAddress', label: 'Property Address', type: 'text', required: true },
        { key: 'clientInsured',   label: 'Client / Insured Name', type: 'text' },
        { key: 'claimNumber',     label: 'Claim Number',  type: 'text' },
        { key: 'policyNumber',    label: 'Policy Number', type: 'text' },
        { key: 'carrier',         label: 'Carrier',       type: 'text' },
        { key: 'dateOfLoss',      label: 'Date of Loss',  type: 'date' }
      ]
    },
    {
      id: 'appraisal_info',
      label: 'Appraisal Information',
      fields: [
        { key: 'opposingAppraiser', label: 'Opposing Appraiser', type: 'text' },
        { key: 'umpire',            label: 'Umpire',             type: 'text' },
        { key: 'inspectionDate',    label: 'Inspection Date',    type: 'date' },
        { key: 'demandDate',        label: 'Demand Date',        type: 'date' },
        { key: 'awardDate',         label: 'Award Date',         type: 'date' },
        { key: 'settlementAmount',  label: 'Settlement Amount',  type: 'currency' }
      ]
    }
  ],

  attachmentCategories: ['Docusketch', 'Photos', 'Reports', 'Estimate Files', 'Other Documents']
};
