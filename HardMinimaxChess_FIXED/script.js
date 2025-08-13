// Elements
const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const overlayEl = document.getElementById('overlay');
const sndMove = document.getElementById('snd-move');
const sndCheck = document.getElementById('snd-check');
const sndMate = document.getElementById('snd-mate');

// Controls
document.getElementById('mode2p').onclick = () => setMode('2player');
document.getElementById('modeHard').onclick = () => setMode('hard');

// State
let board = [];
let currentPlayer = 'white';
let selected = null;
let mode = '2player';
let gameOver = false;

// AI config: deeper on desktop, slightly lower on small screens for speed
const isMobile = Math.min(window.innerWidth, window.innerHeight) < 520;
let AI_DEPTH = isMobile ? 5 : 6;

// Piece values for evaluation
const V = { P:100, N:320, B:330, R:500, Q:900, K:20000 };

function setMode(m){
  mode = m;
  restart();
}

function restart(){
  gameOver = false;
  currentPlayer = 'white';
  selected = null;
  initBoard();
  updateTurn();
  render();
  hideOverlay();
}

function initBoard(){
  board = Array.from({length:8}, ()=> Array(8).fill(null));
  const back = ['R','N','B','Q','K','B','N','R'];
  for(let c=0;c<8;c++){
    board[0][c] = {type:back[c], color:'black'};
    board[1][c] = {type:'P', color:'black'};
    board[6][c] = {type:'P', color:'white'};
    board[7][c] = {type:back[c], color:'white'};
  }
}

function render(){
  boardEl.innerHTML = '';
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const cell = document.createElement('div');
      cell.className = `cell ${(r+c)%2===0?'white':'black'}`;
      cell.dataset.r = r; cell.dataset.c = c;
      const p = board[r][c];
      if(p) cell.textContent = symbol(p);
      cell.addEventListener('click', onCell);
      boardEl.appendChild(cell);
    }
  }
}

function symbol(p){
  const S = {
    P:{white:'♙',black:'♟'}, R:{white:'♖',black:'♜'}, N:{white:'♘',black:'♞'},
    B:{white:'♗',black:'♝'}, Q:{white:'♕',black:'♛'}, K:{white:'♔',black:'♚'}
  };
  return S[p.type][p.color];
}

function updateTurn(){ turnEl.textContent = `${cap(currentPlayer)}'s turn`; }
function cap(s){ return s[0].toUpperCase()+s.slice(1); }

function onCell(e){
  if(gameOver) return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  const p = board[r][c];

  if(selected){
    const moves = legalMoves(selected.r, selected.c, true);
    const ok = moves.some(m => m.r===r && m.c===c);
    clearHighlights();
    if(ok){
      const captured = board[r][c] ? {...board[r][c]} : null;
      move(selected.r, selected.c, r, c);
      playSound(sndMove);
      // King captured? end immediately
      if(captured && captured.type==='K'){
        showOverlay(`CHECKMATE — ${cap(currentPlayer)} Wins!`, true);
        playSound(sndMate);
        gameOver = true;
        render();
        return;
      }
      // Next turn
      currentPlayer = opp(currentPlayer);
      updateTurn();
      render();
      // Show CHECK if opponent's king now attacked
      const inCheck = isKingInCheck(currentPlayer);
      if(inCheck){ showOverlay('CHECK', false); playSound(sndCheck); }
      // AI move if needed
      if(mode!=='2player' && !gameOver){
        setTimeout(aiMove, 50);
      }
    }else{
      selected = null;
      render();
    }
  }else if(p && p.color===currentPlayer){
    selected = {r,c};
    highlightMoves(r,c);
  }
}

function highlightMoves(r,c){
  const moves = legalMoves(r,c, true);
  moves.forEach(m => {
    const idx = m.r*8 + m.c;
    boardEl.children[idx].classList.add('highlight');
  });
}

function clearHighlights(){
  [...boardEl.children].forEach(el => el.classList.remove('highlight'));
}

function inside(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

function addSlide(moves, r,c, dr,dc, color){
  let nr=r+dr, nc=c+dc;
  while(inside(nr,nc)){
    const b=board[nr][nc];
    if(!b){ moves.push({r:nr,c:nc}); }
    else { if(b.color!==color) moves.push({r:nr,c:nc}); break; }
    nr+=dr; nc+=dc;
  }
}

function legalMoves(r,c, allowCaptureKing=false){
  const p = board[r][c];
  if(!p) return [];
  const moves=[];
  const col=p.color;

  if(p.type==='P'){
    const dir = col==='white' ? -1 : 1;
    if(inside(r+dir,c) && !board[r+dir][c]) moves.push({r:r+dir,c:c});
    if((r===6 && col==='white') || (r===1 && col==='black')){
      if(!board[r+dir][c] && inside(r+2*dir,c) && !board[r+2*dir][c]) moves.push({r:r+2*dir,c:c});
    }
    for(const dc of [-1,1]){
      const nr=r+dir, nc=c+dc;
      if(inside(nr,nc) && board[nr][nc] && board[nr][nc].color!==col)
        moves.push({r:nr,c:nc});
    }
  }else if(p.type==='R'){
    addSlide(moves,r,c,1,0,col); addSlide(moves,r,c,-1,0,col);
    addSlide(moves,r,c,0,1,col); addSlide(moves,r,c,0,-1,col);
  }else if(p.type==='B'){
    addSlide(moves,r,c,1,1,col); addSlide(moves,r,c,1,-1,col);
    addSlide(moves,r,c,-1,1,col); addSlide(moves,r,c,-1,-1,col);
  }else if(p.type==='Q'){
    addSlide(moves,r,c,1,0,col); addSlide(moves,r,c,-1,0,col);
    addSlide(moves,r,c,0,1,col); addSlide(moves,r,c,0,-1,col);
    addSlide(moves,r,c,1,1,col); addSlide(moves,r,c,1,-1,col);
    addSlide(moves,r,c,-1,1,col); addSlide(moves,r,c,-1,-1,col);
  }else if(p.type==='K'){
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(dr===0 && dc===0) continue;
      const nr=r+dr, nc=c+dc;
      if(inside(nr,nc) && (!board[nr][nc] || board[nr][nc].color!==col))
        moves.push({r:nr,c:nc});
    }
  }else if(p.type==='N'){
    const ds=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for(const [dr,dc] of ds){
      const nr=r+dr, nc=c+dc;
      if(inside(nr,nc) && (!board[nr][nc] || board[nr][nc].color!==col))
        moves.push({r:nr,c:nc});
    }
  }
  // Note: For simplicity, moves that leave own king in check are allowed.
  // Since win condition is king capture, this keeps gameplay fast and arcade-like.
  return moves;
}

function move(sr,sc,dr,dc){
  board[dr][dc] = board[sr][sc];
  board[sr][sc] = null;
}

function opp(c){ return c==='white'?'black':'white'; }

function findKing(color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.type==='K' && p.color===color) return {r,c};
  }
  return null;
}

function isKingInCheck(color){
  const k = findKing(color);
  if(!k) return false;
  const enemy = opp(color);
  // generate enemy pseudo-legal moves to see if any hit the king square
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.color===enemy){
      const ms = legalMoves(r,c,true);
      if(ms.some(m => m.r===k.r && m.c===k.c)) return true;
    }
  }
  return false;
}

function anyLegalMove(color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.color===color){
      const ms = legalMoves(r,c,true);
      if(ms.length) return true;
    }
  }
  return false;
}

function showOverlay(text, mate=false){
  overlayEl.textContent = text;
  overlayEl.className = mate ? 'show mate' : 'show check';
  // auto-hide after 2.5s (CSS handles fade), but ensure removal of class for next time
  setTimeout(() => hideOverlay(), 2600);
}
function hideOverlay(){
  overlayEl.className = '';
  overlayEl.textContent = '';
}

function playSound(el){
  // attempt play; some mobile browsers require user gesture - clicks will trigger it
  el.currentTime = 0;
  el.play().catch(()=>{});
}

/* ========================= AI (Minimax + Alpha-Beta) ========================= */
function cloneBoard(b){ return b.map(row => row.map(x => x ? {...x} : null)); }

function allMoves(color){
  const list=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.color===color){
      const ms = legalMoves(r,c,true);
      for(const m of ms) list.push({from:{r,c}, to:{r:m.r,c:m.c}});
    }
  }
  return list;
}

function evaluate(){
  // Material + mobility + check pressure
  let score=0;
  let wMob=0, bMob=0;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(!p) continue;
    const val = V[p.type];
    score += (p.color==='white'?val:-val);
    const ms = legalMoves(r,c,true).length;
    if(p.color==='white') wMob += ms; else bMob += ms;
  }
  score += (wMob - bMob) * 2;
  if(isKingInCheck('black')) score += 50;
  if(isKingInCheck('white')) score -= 50;
  return score;
}

function aiMove(){
  if(gameOver) return;
  // Root search with capture bias
  const color = currentPlayer;
  const moves = allMoves(color);
  if(!moves.length){
    // No move: if own king was just captured gameOver would be set; else stalemate
    showOverlay('CHECKMATE — ' + cap(opp(color)) + ' Wins!', true);
    playSound(sndMate);
    gameOver = true;
    return;
  }
  // Order moves: captures first, especially king captures
  moves.sort((a,b)=>{
    const A = board[a.to.r][a.to.c], B = board[b.to.r][b.to.c];
    const va = A ? V[A.type] : 0, vb = B ? V[B.type] : 0;
    return vb - va;
  });

  const snapshot = cloneBoard(board);
  let best = null;
  let bestScore = (color==='white') ? -Infinity : Infinity;

  for(const mv of moves){
    const cap = board[mv.to.r][mv.to.c];
    move(mv.from.r, mv.from.c, mv.to.r, mv.to.c);
    // Immediate win if king captured
    if(cap && cap.type==='K'){
      board = snapshot; // restore, then play the winning move for real
      executeAIMove(mv);
      return;
    }
    const sc = minimax(AI_DEPTH-1, opp(color), -Infinity, Infinity);
    board = cloneBoard(snapshot);
    if(color==='white'){
      if(sc > bestScore){ bestScore=sc; best=mv; }
    }else{
      if(sc < bestScore){ bestScore=sc; best=mv; }
    }
  }
  executeAIMove(best);
}

function executeAIMove(mv){
  const captured = board[mv.to.r][mv.to.c] ? {...board[mv.to.r][mv.to.c]} : null;
  move(mv.from.r, mv.from.c, mv.to.r, mv.to.c);
  render();
  playSound(sndMove);
  if(captured && captured.type==='K'){
    showOverlay(`CHECKMATE — ${cap(currentPlayer)} Wins!`, true);
    playSound(sndMate);
    gameOver = true;
    return;
  }
  currentPlayer = opp(currentPlayer);
  updateTurn();
  const inCheck = isKingInCheck(currentPlayer);
  if(inCheck){ showOverlay('CHECK', false); playSound(sndCheck); }
}

function minimax(depth, color, alpha, beta){
  // Terminal checks
  if(depth<=0) return evaluate();

  const myMoves = allMoves(color);
  if(!myMoves.length) return evaluate();

  const snapshot = cloneBoard(board);

  // Move ordering: captures first
  myMoves.sort((a,b)=>{
    const A = board[a.to.r][a.to.c], B = board[b.to.r][b.to.c];
    const va = A ? V[A.type] : 0, vb = B ? V[B.type] : 0;
    return vb - va;
  });

  if(color==='white'){
    let maxEval = -Infinity;
    for(const mv of myMoves){
      const cap = board[mv.to.r][mv.to.c];
      move(mv.from.r, mv.from.c, mv.to.r, mv.to.c);
      // Bonus for capturing big pieces
      let evalScore;
      if(cap && cap.type==='K'){ evalScore = 999999; }
      else { evalScore = minimax(depth-1, 'black', alpha, beta); }
      board = cloneBoard(snapshot);
      if(evalScore > maxEval) maxEval = evalScore;
      if(evalScore > alpha) alpha = evalScore;
      if(beta <= alpha) break;
    }
    return maxEval;
  }else{
    let minEval = Infinity;
    for(const mv of myMoves){
      const cap = board[mv.to.r][mv.to.c];
      move(mv.from.r, mv.from.c, mv.to.r, mv.to.c);
      let evalScore;
      if(cap && cap.type==='K'){ evalScore = -999999; }
      else { evalScore = minimax(depth-1, 'white', alpha, beta); }
      board = cloneBoard(snapshot);
      if(evalScore < minEval) minEval = evalScore;
      if(evalScore < beta) beta = evalScore;
      if(beta <= alpha) break;
    }
    return minEval;
  }
}

/* --------------------------- Start the game --------------------------- */
restart();
