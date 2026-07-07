// CardModal.jsx — ported from public/js/card-modal.js.
// Appraisal cards: Details | Notes | Files & Links | Activity | Estimates | Payments
// Estimate  cards: Details | Notes | Files & Links | Activity | Appraisal  | Payments
// Payment   cards: Details | Notes | Files & Links | Activity
import { useEffect, useRef, useState } from 'react';
import { useToast } from './Toast.jsx';
import { formatDateShort, formatTimestamp } from '../lib/utils.js';
import {
  fetchCard, createCard, updateCard, deleteCard,
  addNote, addAttachment, uploadAttachmentFile, getAttachmentSignedUrl
} from '../lib/cardsApi.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function FieldInput({ f, value }) {
  const id = `cf-${f.key}`;
  const val = value || '';
  if (f.type === 'date') return <input type="date" id={id} data-field={f.key} defaultValue={val} />;
  if (f.type === 'currency') return <input type="text" id={id} data-field={f.key} inputMode="decimal" placeholder="0.00" defaultValue={val} />;
  if (f.type === 'select') {
    return (
      <select id={id} data-field={f.key} defaultValue={val}>
        <option value=""></option>
        {(f.options || []).map(o => <option value={o} key={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === 'url') {
    return (
      <div className="url-field-group">
        <input type="url" id={id} data-field={f.key} placeholder={f.placeholder || 'https://'} defaultValue={val} />
        {val && <a href={val} target="_blank" rel="noopener noreferrer" className="btn btn-sm url-open-btn">Open ↗</a>}
      </div>
    );
  }
  return <input type="text" id={id} data-field={f.key} placeholder={f.placeholder || ''} defaultValue={val} required={!!f.required} />;
}

function DetailsForm({ formRef, mode, config, card, createDefaults, users }) {
  const vals = mode === 'create' ? createDefaults : card;
  const custom = mode === 'create' ? {} : (card?.fields || {});
  return (
    <form ref={formRef}>
      <div className="field-group">
        <div className="field-group-title">Status &amp; Tracking</div>
        <div className="field-row cols-2">
          <div className="field"><label htmlFor="f-status">Status</label>
            <select id="f-status" defaultValue={vals?.status || config.columns[0].id}>
              {config.columns.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="f-priority">Priority</label>
            <select id="f-priority" defaultValue={vals?.priority || 'medium'}>
              {config.priorities.map(p => <option value={p.id} key={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="f-assigned">Assigned To</label>
          <input type="text" id="f-assigned" list="people-dl" defaultValue={vals?.assignedTo || ''} />
        </div>
        <div className="field"><label htmlFor="f-nextstep">Next Step</label>
          <input type="text" id="f-nextstep" placeholder="What needs to happen next?" defaultValue={vals?.nextStep || ''} />
        </div>
        <div className="field"><label htmlFor="f-latestupdate">Latest Update</label>
          <textarea id="f-latestupdate" placeholder="Short status summary..." defaultValue={vals?.latestUpdate || ''}></textarea>
        </div>
        {mode === 'edit' && (
          <div className="field"><label>Date Updated</label>
            <div className="field-hint" style={{ marginTop: 8 }}>{formatDateShort(card.dateUpdated)} — auto-set on every save</div>
          </div>
        )}
      </div>
      {config.fieldGroups.map(g => (
        <div className="field-group" key={g.id}>
          <div className="field-group-title">{g.label}</div>
          {g.fields.map(f => (
            <div className="field" key={f.key}>
              <label htmlFor={`cf-${f.key}`}>{f.label}{f.required ? ' *' : ''}</label>
              <FieldInput f={f} value={custom[f.key]} />
              {f.hint && <div className="field-hint">{f.hint}</div>}
            </div>
          ))}
        </div>
      ))}
      <datalist id="people-dl">{users.map(u => <option value={u.name} key={u.id} />)}</datalist>
    </form>
  );
}

function readForm(formEl, config) {
  const vals = {
    status: formEl.querySelector('#f-status').value,
    priority: formEl.querySelector('#f-priority').value,
    assignedTo: formEl.querySelector('#f-assigned').value.trim(),
    nextStep: formEl.querySelector('#f-nextstep').value.trim(),
    latestUpdate: formEl.querySelector('#f-latestupdate').value.trim(),
    fields: {}
  };
  config.fieldGroups.forEach(g => g.fields.forEach(f => {
    const el = formEl.querySelector(`[data-field="${f.key}"]`);
    vals.fields[f.key] = el ? el.value.trim() : '';
  }));
  return vals;
}

function NotesPanel({ card, onAddNote }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div id="notes-list">
        {!card.notes.length
          ? <div className="thread-empty">No notes yet.</div>
          : card.notes.slice().reverse().map(n => (
            <div className="thread-item" key={n.id}>
              <div className="thread-meta"><span className="who">{n.author}</span><span>{formatTimestamp(n.createdAt)}</span></div>
              <div>{n.text.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}</div>
            </div>
          ))}
      </div>
      <div className="note-compose">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Add a note..." />
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => {
          if (!text.trim()) return;
          setBusy(true);
          await onAddNote(text.trim());
          setText(''); setBusy(false);
        }}>Add</button>
      </div>
    </>
  );
}

function AttachmentRow({ att }) {
  const [href, setHref] = useState(att.kind === 'link' ? att.url : null);
  useEffect(() => {
    let cancelled = false;
    if (att.kind === 'file' && att.path) {
      getAttachmentSignedUrl(att.path).then(url => { if (!cancelled) setHref(url); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [att]);
  return (
    <div className="attachment-row">
      <span className="att-icon">{att.kind === 'file' ? 'FILE' : 'LINK'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer">{att.label}</a>
          : <span>{att.label}</span>}
        <div className="att-meta">by {att.addedBy} · {formatTimestamp(att.addedAt)}</div>
      </div>
    </div>
  );
}

function AttachmentsPanel({ config, card, onAddLink, onAddFile }) {
  const [linkInputs, setLinkInputs] = useState({});
  const [fileInputs, setFileInputs] = useState({});
  const [busy, setBusy] = useState(false);

  return (
    <>
      {config.attachmentCategories.map(cat => {
        const items = card.attachments.filter(a => a.category === cat);
        const s = slug(cat);
        const li = linkInputs[s] || { url: '', label: '' };
        return (
          <div className="attachment-category" key={cat}>
            <div className="attachment-category-title"><span>{cat}</span><span className="count">{items.length}</span></div>
            {items.length
              ? items.map(a => <AttachmentRow key={a.id} att={a} />)
              : <div className="thread-empty">Nothing here yet.</div>}
            <div className="attach-add-row">
              <div className="link-fields">
                <input type="url" placeholder="https://..." value={li.url}
                  onChange={e => setLinkInputs(v => ({ ...v, [s]: { ...li, url: e.target.value } }))} />
                <input type="text" className="label-input" placeholder="Label (optional)" value={li.label}
                  onChange={e => setLinkInputs(v => ({ ...v, [s]: { ...li, label: e.target.value } }))} />
                <button className="btn btn-sm" disabled={busy} onClick={async () => {
                  setBusy(true);
                  await onAddLink(cat, li.url, li.label);
                  setLinkInputs(v => ({ ...v, [s]: { url: '', label: '' } }));
                  setBusy(false);
                }}>Add link</button>
              </div>
            </div>
            <div className="attach-add-row">
              <input type="file" onChange={e => setFileInputs(v => ({ ...v, [s]: e.target.files[0] }))} />
              <button className="btn btn-sm" disabled={busy} onClick={async () => {
                setBusy(true);
                await onAddFile(cat, fileInputs[s]);
                setFileInputs(v => ({ ...v, [s]: null }));
                setBusy(false);
              }}>Upload</button>
            </div>
          </div>
        );
      })}
      <p className="field-hint">Max 25MB per file.</p>
    </>
  );
}

function ActivityPanel({ card }) {
  if (!card.activity.length) return <div className="thread-empty">No activity yet.</div>;
  return card.activity.slice().reverse().map(a => (
    <div className="thread-item" key={a.id}>
      <div className="thread-meta"><span className="who">{a.author}</span><span>{formatTimestamp(a.createdAt)}</span></div>
      <div>{a.detail}</div>
    </div>
  ));
}

function RelatedEstimates({ card, onGoto }) {
  const related = card._relatedEstimates || [];
  return (
    <div className="related-panel">
      <div className="related-panel-head"><span>Related Estimates</span><span className="rp-count">{related.length}</span></div>
      {related.length
        ? related.map(e => (
          <div className="related-row" key={e.id}>
            <span className="rr-id">{e.jobId || 'EST-???'}</span>
            <span className="rr-addr">{e.propertyAddress || ''}
              {e.estimateType && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> ({e.estimateType})</span>}
            </span>
            <span className="rr-status">{e.status.replace(/_/g, ' ')}</span>
            <button className="rr-goto btn btn-quiet btn-sm" onClick={() => onGoto(e.id)}>Open →</button>
          </div>
        ))
        : <div className="related-empty">No estimates linked to {card.jobId || 'this job'} yet.</div>}
    </div>
  );
}

function RelatedPayments({ card, onGoto }) {
  const related = card._relatedPayments || [];
  const fmt = v => {
    if (!v) return '—';
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? v : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };
  return (
    <div className="related-panel">
      <div className="related-panel-head"><span>Related Payments</span><span className="rp-count">{related.length}</span></div>
      {related.length
        ? related.map(p => (
          <div className="related-row" key={p.id}>
            <span className="rr-id">{p.jobId || 'PAY-???'}</span>
            <span className="rr-addr">{p.vendorName || p.propertyAddress || ''}
              {p.serviceType && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> ({p.serviceType})</span>}
            </span>
            <span className="rr-status" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmt(p.invoiceAmount)}</span>
            <span className="rr-status">{p.status.replace(/_/g, ' ')}</span>
            <button className="rr-goto btn btn-quiet btn-sm" onClick={() => onGoto(p.id)}>Open →</button>
          </div>
        ))
        : <div className="related-empty">No payments linked to {card.jobId || 'this job'} yet.</div>}
    </div>
  );
}

function RelatedAppraisal({ card, onGoto }) {
  const a = card._relatedAppraisal;
  if (!a) {
    const linkedId = card.fields?.linkedAppraisalId;
    return (
      <div className="appraisal-info-panel">
        <div className="aip-head">⚖️ Linked Appraisal Job</div>
        <div className="aip-none">
          {linkedId
            ? `No appraisal found with Job ID "${linkedId}". Check the ID in the Details tab.`
            : 'No Appraisal Job ID entered. Add one in the Details tab under "Linked Appraisal Job ID".'}
        </div>
      </div>
    );
  }
  const rows = [
    ['Job ID', a.jobId || '—'], ['Address', a.propertyAddress || '—'],
    ['Client', a.clientInsured || '—'], ['Claim #', a.claimNumber || '—'],
    ['Carrier', a.carrier || '—'], ['Status', a.status.replace(/_/g, ' ')],
    ['Priority', a.priority], ['Assigned', a.assignedTo || '—']
  ];
  return (
    <div className="appraisal-info-panel">
      <div className="aip-head">⚖️ {a.jobId || 'Appraisal Job'}</div>
      <div className="aip-body">
        {rows.map(([l, v]) => (
          <div className="aip-row" key={l}><span className="aip-label">{l}</span><span className="aip-val">{v}</span></div>
        ))}
        <button className="aip-goto" onClick={() => onGoto(a.id)}>Open in Appraisal Board →</button>
      </div>
    </div>
  );
}

export default function CardModal({
  mode, boardConfig, users, me, cardId, createDefaults,
  onClose, onChanged, onNavigateToEstimate, onNavigateToPayment, onNavigateToAppraisal
}) {
  const toast = useToast();
  const [card, setCard] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    setActiveTab('details');
    if (mode === 'edit' && cardId) {
      setCard(null);
      fetchCard(boardConfig.id, cardId).then(setCard).catch(err => { toast(err.message, true); onClose(); });
    }
  }, [mode, cardId]);

  useEffect(() => {
    if (!mode) return;
    function escHandler(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', escHandler);
    return () => document.removeEventListener('keydown', escHandler);
  }, [mode]);

  async function refreshCard() {
    const updated = await fetchCard(boardConfig.id, cardId);
    setCard(updated);
    return updated;
  }

  if (!mode) return null;
  const isCreate = mode === 'create';
  if (!isCreate && !card) return null; // loading

  const titleField = boardConfig.titleField;
  const requiredLabel = () => {
    const defs = boardConfig.fieldGroups.flatMap(g => g.fields);
    return (defs.find(f => f.key === titleField) || {}).label || 'Title';
  };

  async function submitCreate() {
    const vals = readForm(formRef.current, boardConfig);
    if (!vals.fields[titleField]) { toast(`${requiredLabel()} is required.`, true); return; }
    setBusy(true);
    try {
      await createCard(boardConfig, vals, me.name);
      toast('Job created.'); onClose(); onChanged();
    } catch (err) { toast(err.message, true); setBusy(false); }
  }

  async function submitSave() {
    const vals = readForm(formRef.current, boardConfig);
    if (!vals.fields[titleField]) { toast(`${requiredLabel()} is required.`, true); return; }
    setBusy(true);
    try {
      const move = vals.status !== card.status ? { status: vals.status } : null;
      const patch = { priority: vals.priority, assignedTo: vals.assignedTo, nextStep: vals.nextStep, latestUpdate: vals.latestUpdate, fields: vals.fields };
      await updateCard(boardConfig, card.id, patch, move, me.name);
      toast('Saved.'); await refreshCard(); onChanged(); setBusy(false);
    } catch (err) { toast(err.message, true); setBusy(false); }
  }

  async function submitDelete() {
    const t = card.fields?.[titleField] || 'this job';
    if (!window.confirm(`Delete "${t}"? This cannot be undone.`)) return;
    try { await deleteCard(boardConfig, card.id); toast('Deleted.'); onClose(); onChanged(); }
    catch (err) { toast(err.message, true); }
  }

  async function handleAddNote(text) {
    try { await addNote(boardConfig, card.id, text, me.name); await refreshCard(); onChanged(); }
    catch (err) { toast(err.message, true); }
  }

  async function handleAddLink(category, url, label) {
    if (!url.trim()) { toast('Enter a URL first.', true); return; }
    try {
      await addAttachment(boardConfig, card.id, { kind: 'link', category, url: url.trim(), label: (label.trim()) || url.trim() }, me.name);
      await refreshCard(); onChanged();
    } catch (err) { toast(err.message, true); }
  }

  async function handleAddFile(category, file) {
    if (!file) { toast('Choose a file first.', true); return; }
    if (file.size > MAX_FILE_BYTES) { toast('File is larger than 25MB.', true); return; }
    try {
      await uploadAttachmentFile(boardConfig, card.id, file, category, me.name);
      await refreshCard(); onChanged();
    } catch (err) { toast(err.message, true); }
  }

  function extraTabs() {
    const id = boardConfig.id;
    const tabs = [];
    if (id === 'appraisal') {
      tabs.push({ key: 'estimates', label: `Estimates (${(card._relatedEstimates || []).length})` });
      tabs.push({ key: 'payments', label: `Payments (${(card._relatedPayments || []).length})` });
    }
    if (id === 'estimate') {
      tabs.push({ key: 'appraisal', label: 'Appraisal' });
      tabs.push({ key: 'payments', label: `Payments (${(card._relatedPayments || []).length})` });
    }
    return tabs;
  }

  const title = isCreate ? 'New job' : (card.fields?.[titleField] || '(no title)');
  const sub = isCreate
    ? `Create a job on the ${boardConfig.label}`
    : `${card.jobId ? card.jobId + ' · ' : ''}${(boardConfig.columns.find(c => c.id === card.status) || {}).label || card.status}`;

  const stdTabs = ['details', 'notes', 'attachments', 'activity'];
  const extTabs = isCreate ? [] : extraTabs();
  const allTabs = [...stdTabs, ...extTabs.map(t => t.key)];
  const tabLabels = {
    details: 'Details',
    notes: `Notes (${card?.notes?.length || 0})`,
    attachments: `Files & Links (${card?.attachments?.length || 0})`,
    activity: 'Activity',
    ...Object.fromEntries(extTabs.map(t => [t.key, t.label]))
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><h2 id="modal-title">{title}</h2><div className="modal-sub">{sub}</div></div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        </div>

        {!isCreate && (
          <div className="tabs">
            {allTabs.map(k => (
              <button key={k} className={`tab-btn${activeTab === k ? ' active' : ''}`} onClick={() => setActiveTab(k)}>
                {tabLabels[k]}
              </button>
            ))}
          </div>
        )}

        <div className="modal-body">
          {isCreate ? (
            <DetailsForm formRef={formRef} mode="create" config={boardConfig} card={null} createDefaults={createDefaults} users={users} />
          ) : (
            <>
              <div className={`tab-panel${activeTab === 'details' ? ' active' : ''}`}>
                <DetailsForm formRef={formRef} mode="edit" config={boardConfig} card={card} createDefaults={null} users={users} />
              </div>
              <div className={`tab-panel${activeTab === 'notes' ? ' active' : ''}`}>
                <NotesPanel card={card} onAddNote={handleAddNote} />
              </div>
              <div className={`tab-panel${activeTab === 'attachments' ? ' active' : ''}`}>
                <AttachmentsPanel config={boardConfig} card={card} onAddLink={handleAddLink} onAddFile={handleAddFile} />
              </div>
              <div className={`tab-panel${activeTab === 'activity' ? ' active' : ''}`}>
                <ActivityPanel card={card} />
              </div>
              {extTabs.some(t => t.key === 'estimates') && (
                <div className={`tab-panel${activeTab === 'estimates' ? ' active' : ''}`}>
                  <RelatedEstimates card={card} onGoto={id => { onClose(); onNavigateToEstimate(id); }} />
                </div>
              )}
              {extTabs.some(t => t.key === 'payments') && (
                <div className={`tab-panel${activeTab === 'payments' ? ' active' : ''}`}>
                  <RelatedPayments card={card} onGoto={id => { onClose(); onNavigateToPayment(id); }} />
                </div>
              )}
              {extTabs.some(t => t.key === 'appraisal') && (
                <div className={`tab-panel${activeTab === 'appraisal' ? ' active' : ''}`}>
                  <RelatedAppraisal card={card} onGoto={id => { onClose(); onNavigateToAppraisal(id); }} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {isCreate ? (
            <>
              <span></span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" disabled={busy} onClick={submitCreate}>{busy ? 'Creating...' : 'Create job'}</button>
              </div>
            </>
          ) : (
            <>
              <button className="btn btn-danger btn-sm" onClick={submitDelete}>Delete job</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-quiet" onClick={onClose}>Close</button>
                <button className="btn btn-primary" disabled={busy} onClick={submitSave}>{busy ? 'Saving...' : 'Save changes'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
