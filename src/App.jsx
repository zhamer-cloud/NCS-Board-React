// App.jsx — ported from public/js/app.js: manages views (Dashboard / Board /
// Coming Soon), nav, filters, and wires the board + modal together.
import { useEffect, useState, useCallback } from 'react';
import { ToastProvider, useToast } from './components/Toast.jsx';
import { getSession, onAuthStateChange, getMyProfile, listProfiles, signOut } from './lib/auth.js';
import { list as listBoards, get as getBoard } from './boards/index.js';
import { PRIORITIES } from './config.js';
import { fetchCardsForBoard, fetchBoardDashboard, fetchGlobalDashboard, updateCard, orderBetween } from './lib/cardsApi.js';
import Login from './components/Login.jsx';
import TopBar from './components/TopBar.jsx';
import PrimaryNav from './components/PrimaryNav.jsx';
import DashboardView from './components/DashboardView.jsx';
import DashboardStrip from './components/DashboardStrip.jsx';
import BoardView from './components/BoardView.jsx';
import ComingSoonView from './components/ComingSoonView.jsx';
import CardModal from './components/CardModal.jsx';

const EMPTY_FILTERS = { search: '', status: '', priority: '', assignee: '' };

function AppInner() {
  const toast = useToast();

  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [me, setMe] = useState(null);
  const [boardsList, setBoardsList] = useState([]);
  const [users, setUsers] = useState([]);

  const [activeView, setActiveView] = useState('dashboard'); // dashboard | board | coming-soon
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [config, setConfig] = useState(null);
  const [cards, setCards] = useState([]);
  const [dashboard, setDashboard] = useState({ totalOpen: 0, byStatus: {} });
  const [globalDashboard, setGlobalDashboard] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [modal, setModal] = useState({ mode: null, cardId: null, createDefaults: null });

  // ── session bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    getSession().then(setSession);
    return onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const [profile, boards, allUsers] = await Promise.all([getMyProfile(), listBoards(), listProfiles()]);
        setMe(profile);
        setBoardsList(boards);
        setUsers(allUsers);
        const startBoard = new URLSearchParams(window.location.search).get('board');
        if (startBoard) await activateBoard(startBoard, boards);
        else await activateDashboard();
      } catch (err) {
        toast(err.message, true);
      }
    })();
  }, [session]);

  // ── view switching ────────────────────────────────────────────────────
  async function activateDashboard() {
    setActiveView('dashboard');
    const url = new URL(window.location); url.searchParams.delete('board');
    window.history.replaceState({}, '', url);
    try { setGlobalDashboard(await fetchGlobalDashboard()); }
    catch (err) { toast(err.message, true); }
  }

  async function activateBoard(boardId, boardsOverride) {
    const list = boardsOverride || boardsList;
    const board = list.find(b => b.id === boardId);
    if (!board) return;
    if (board.comingSoon) { activateComingSoon(board); return; }

    setActiveBoardId(boardId);
    setActiveView('board');
    const url = new URL(window.location); url.searchParams.set('board', boardId);
    window.history.replaceState({}, '', url);

    const bc = { ...getBoard(boardId), priorities: PRIORITIES };
    setConfig(bc);
    setFilters(EMPTY_FILTERS);

    try {
      const [cardRows, dash] = await Promise.all([fetchCardsForBoard(boardId), fetchBoardDashboard(boardId)]);
      setCards(cardRows);
      setDashboard(dash);
    } catch (err) {
      toast(err.message, true);
    }
  }

  function activateComingSoon(board) {
    setActiveBoardId(board.id);
    setActiveView('coming-soon');
  }

  const comingSoonBoard = activeView === 'coming-soon' ? boardsList.find(b => b.id === activeBoardId) : null;

  // ── data refresh ──────────────────────────────────────────────────────
  const refreshBoardData = useCallback(async () => {
    if (activeView !== 'board' || !activeBoardId) return;
    try {
      const [cardRows, dash] = await Promise.all([fetchCardsForBoard(activeBoardId), fetchBoardDashboard(activeBoardId)]);
      setCards(cardRows);
      setDashboard(dash);
    } catch (err) { toast(err.message, true); }
  }, [activeView, activeBoardId]);

  async function handleCardMove(cardId, move) {
    const before = move.beforeId ? cards.find(c => c.id === move.beforeId) : null;
    const after = move.afterId ? cards.find(c => c.id === move.afterId) : null;
    const order = orderBetween(after?.order, before?.order);
    const prevStatus = cards.find(c => c.id === cardId)?.status;

    setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: move.status, order } : c));

    try {
      const updated = await updateCard(config, cardId, {}, { status: move.status, order }, me.name);
      setCards(prev => prev.map(c => c.id === cardId ? updated : c));
      setDashboard(await fetchBoardDashboard(activeBoardId));
    } catch (err) {
      toast(err.message, true);
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: prevStatus } : c));
    }
  }

  // ── modal ───────────────────────────────────────────────────────────────
  function openCreate(defaults) { setModal({ mode: 'create', cardId: null, createDefaults: defaults || {} }); }
  function openEdit(cardId) { setModal({ mode: 'edit', cardId, createDefaults: null }); }
  function closeModal() { setModal({ mode: null, cardId: null, createDefaults: null }); }

  async function navigateToBoard(boardId, cardId) {
    await activateBoard(boardId);
    if (cardId) openEdit(cardId);
  }

  async function handleLogout() {
    await signOut();
    setSession(null); setMe(null); setActiveView('dashboard'); setActiveBoardId(null);
  }

  // ── render ──────────────────────────────────────────────────────────────
  if (session === undefined) return null; // checking session
  if (!session) return <Login />;
  if (!me) return null; // profile still loading

  const showFilters = activeView === 'board';

  return (
    <div className="app-shell">
      <TopBar
        me={me} showFilters={showFilters} config={config} users={users}
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={() => setFilters(EMPTY_FILTERS)}
        onNewJob={() => openCreate({ status: config?.columns[0]?.id })}
        onLogout={handleLogout}
      />

      <PrimaryNav
        boardsList={boardsList} activeView={activeView} activeBoardId={activeBoardId}
        onSelectDashboard={activateDashboard}
        onSelectBoard={board => board.comingSoon ? activateComingSoon(board) : activateBoard(board.id)}
      />

      <div className="content-area">
        <div className={`view${activeView === 'dashboard' ? ' active' : ''}`} id="view-dashboard">
          <DashboardView data={globalDashboard} onOpenBoard={activateBoard} />
        </div>

        <div className={`view board-view${activeView === 'board' ? ' active' : ''}`} id="view-board">
          {config && (
            <>
              <DashboardStrip
                config={config} dashboard={dashboard} filters={filters}
                onToggleStatus={s => setFilters(f => ({ ...f, status: f.status === s ? '' : s }))}
              />
              <BoardView
                config={config} cards={cards} filters={filters}
                onCardClick={openEdit}
                onCardMove={handleCardMove}
                onQuickAdd={status => openCreate({ status })}
              />
            </>
          )}
        </div>

        <div className={`view${activeView === 'coming-soon' ? ' active' : ''}`} id="view-coming-soon">
          <ComingSoonView board={comingSoonBoard} />
        </div>
      </div>

      <CardModal
        mode={modal.mode}
        boardConfig={config}
        users={users}
        me={me}
        cardId={modal.cardId}
        createDefaults={modal.createDefaults}
        onClose={closeModal}
        onChanged={refreshBoardData}
        onNavigateToEstimate={id => navigateToBoard('estimate', id)}
        onNavigateToPayment={id => navigateToBoard('payment', id)}
        onNavigateToAppraisal={id => navigateToBoard('appraisal', id)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
