// task.js — TASK board config (internal team tasks for Louie, Zack, Jobe).
// Deliberately NOT registered in boards/index.js's REGISTRY: that registry
// drives the existing Appraisal/Estimate/Payment dashboard grid and cross-
// board linking in cardsApi.js, neither of which should know about tasks.
// App.jsx imports this config directly and routes 'task' board requests to
// tasksApi.js instead of cardsApi.js.
export default {
  id: 'task',
  label: 'TASK',
  description: 'Internal team tasks for Louie, Zack, and Jobe.',
  jobIdPrefix: null,
  navIcon: '✅',
  itemLabel: 'task',

  columns: [
    { id: 'to_do',       label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'waiting',     label: 'Waiting' },
    { id: 'completed',   label: 'Completed' }
  ],

  closedStatuses: ['completed'],
  titleField: 'title',
  swimlaneField: null,
  cardPreviewFields: [],

  assigneeOptions: ['Louie', 'Zack', 'Jobe'],
  latestUpdateLabel: 'Description / Notes',
  showDateCreated: true,

  fieldGroups: [
    {
      id: 'task_info',
      label: 'Task Details',
      fields: [
        { key: 'title',   label: 'Task Title', type: 'text', required: true },
        { key: 'dueDate', label: 'Due Date',    type: 'date' }
      ]
    }
  ],

  attachmentCategories: []
};
