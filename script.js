const API_KEY = '0010a32a4e1e60188f2036b82b0a8a1b';
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_PATH = 'https://image.tmdb.org/t/p/w1280';

// Using LocalStorage since AppScript is paused
let myData = JSON.parse(localStorage.getItem('watchopedia_v8')) || { watchlist: [], inprogress: [], watched: [] };
let tempSelection = null;
let currentRating = 0;

function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    if(pageId === 'homePage') renderHome();
    if(pageId === 'explorePage') getExplore();
}

function closeEditForm() {
    document.getElementById('editForm').style.display = 'none';
    document.getElementById('adminSearch').value = '';
    tempSelection = null;
}

// --- HOME PAGE & RIGHT CLICK LOGIC ---
const contextMenu = document.getElementById('contextMenu');
let rightClickedItem = null;

function renderHome() {
    const draw = (list, id) => {
        const el = document.getElementById(id);
        el.innerHTML = list.length ? '' : '<p style="color:#333; font-style:italic;">Empty section.</p>';
        list.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            
            // Attach Right-Click Event
            card.oncontextmenu = (e) => showContextMenu(e, item);
            
            // Left-Click still opens details
            card.innerHTML = `<img src="${IMG_PATH + item.poster}" onclick='openHomeDetail(${JSON.stringify(item).replace(/'/g, "&apos;")})'>`;
            el.appendChild(card);
        });
    };
    draw(myData.watchlist, 'homeWatchlist');
    draw(myData.inprogress, 'homeInProgress');
    draw(myData.watched, 'homeWatched');
}

// Show Context Menu
function showContextMenu(e, item) {
    e.preventDefault(); // Stop default browser menu
    rightClickedItem = item;
    
    // Hide the status the item is currently in
    document.getElementById('menuMoveWatchlist').style.display = item.status === 'watchlist' ? 'none' : 'block';
    document.getElementById('menuMoveInProgress').style.display = item.status === 'inprogress' ? 'none' : 'block';
    document.getElementById('menuMoveWatched').style.display = item.status === 'watched' ? 'none' : 'block';

    // Position menu at mouse cursor
    let x = e.pageX;
    let y = e.pageY;
    
    // Safety check so menu doesn't go off-screen
    if (x + 200 > window.innerWidth) x = window.innerWidth - 220;

    contextMenu.style.top = `${y}px`;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.display = 'block';
}

// Hide Context Menu when clicking anywhere else
document.addEventListener('click', () => {
    if (contextMenu.style.display === 'block') {
        contextMenu.style.display = 'none';
    }
});

// Actions fired from the Context Menu
function contextChangeStatus(newStatus) {
    if (rightClickedItem) {
        changeStatus(rightClickedItem.id, rightClickedItem.status, newStatus);
    }
}

function contextRemoveItem() {
    if (rightClickedItem) {
        ['watchlist', 'inprogress', 'watched'].forEach(key => {
            myData[key] = myData[key].filter(i => i.id !== rightClickedItem.id);
        });
        localStorage.setItem('watchopedia_v8', JSON.stringify(myData));
        renderHome();
    }
}

function changeStatus(id, oldStatus, newStatus) {
    const itemIndex = myData[oldStatus].findIndex(i => i.id === id);
    const item = myData[oldStatus].splice(itemIndex, 1)[0];
    item.status = newStatus;
    myData[newStatus].push(item);
    localStorage.setItem('watchopedia_v8', JSON.stringify(myData));
    renderHome();
}

// --- RECORD DETAIL MODAL ---
function openHomeDetail(item) {
    document.getElementById('modalHero').style.backgroundImage = `url(${BACKDROP_PATH + item.backdrop})`;
    document.getElementById('hTitle').innerText = item.title;
    document.getElementById('hMeta').innerText = `${item.genres} • ${item.type.toUpperCase()}`;
    document.getElementById('hPlot').innerText = item.overview;
    document.getElementById('hCast').innerText = item.cast;

    const journal = document.getElementById('hJournal');
    journal.innerHTML = item.status === 'watched' ? 
        `<h3>Journal Entry</h3><p>Rating: <span style="color:#fff">${'★'.repeat(item.rating) || 'Unrated'}</span></p><p style="color:#ccc">"${item.review || 'No notes left.'}"</p>` : 
        `<p class="accent-text">Progress: ${item.status === 'inprogress' ? 'Currently Watching' : 'Yet to Watch'}</p>`;

    document.getElementById('homeDetailModal').style.display = 'block';
}

function closeHomeDetail() { document.getElementById('homeDetailModal').style.display = 'none'; }


// --- ADD / CURATE LOGIC ---
const adminSearch = document.getElementById('adminSearch');
const adminSearchResults = document.getElementById('adminSearchResults');

adminSearch.addEventListener('input', async (e) => {
    const query = e.target.value;
    if (query.length < 3) {
        adminSearchResults.innerHTML = '';
        adminSearchResults.style.display = 'none';
        return;
    }

    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${query}`);
    const data = await res.json();
    
    adminSearchResults.innerHTML = '';
    
    if (data.results.length > 0) {
        adminSearchResults.style.display = 'block';
        data.results.slice(0, 5).forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerText = `${item.title || item.name} (${(item.release_date || item.first_air_date || 'N/A').split('-')[0]})`;
            div.onclick = () => selectForEdit(item);
            adminSearchResults.appendChild(div);
        });
    } else {
        adminSearchResults.style.display = 'none';
    }
});

async function selectForEdit(item) {
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
    const details = await res.json();

    tempSelection = {
        id: item.id, title: item.title || item.name, poster: item.poster_path, backdrop: item.backdrop_path,
        type: type, overview: item.overview, cast: details.credits && details.credits.cast ? details.credits.cast.slice(0,5).map(c=>c.name).join(', ') : 'N/A',
        genres: details.genres ? details.genres.map(g=>g.name).join(', ') : 'N/A'
    };

    document.getElementById('editForm').style.display = 'block';
    document.getElementById('editTitle').innerText = tempSelection.title;
    document.getElementById('editPoster').src = IMG_PATH + tempSelection.poster;
    adminSearchResults.style.display = 'none';
    adminSearch.value = '';

    const existing = [...myData.watchlist, ...myData.inprogress, ...myData.watched].find(i => i.id === item.id);
    if(existing) {
        document.getElementById('formStatus').value = existing.status;
        document.getElementById('formReview').value = existing.review || '';
        currentRating = existing.rating || 0;
        updateStarsUI();
    } else {
        document.getElementById('formStatus').value = 'watchlist';
        document.getElementById('formReview').value = '';
        currentRating = 0;
        updateStarsUI();
    }

    const sSelect = document.getElementById('formSeason');
    const eSelect = document.getElementById('formEp');
    sSelect.innerHTML = '<option value="">Select Season</option>';
    eSelect.innerHTML = '<option value="">Select Episode</option>';

    if (type === 'tv' && details.seasons) {
        details.seasons.forEach(s => {
            if(s.season_number > 0) {
                const opt = document.createElement('option');
                opt.value = s.season_number;
                opt.innerText = `Season ${s.season_number}`;
                sSelect.appendChild(opt);
            }
        });
        if(existing && existing.season) {
            sSelect.value = existing.season;
            await updateEpisodes();
            if(existing.episode) eSelect.value = existing.episode;
        }
    }
    
    toggleFormFields();
}

async function updateEpisodes() {
    const sNum = document.getElementById('formSeason').value;
    const eSelect = document.getElementById('formEp');
    
    if (!sNum) {
        eSelect.innerHTML = '<option value="">Select Episode</option>';
        return;
    }

    eSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tempSelection.id}/season/${sNum}?api_key=${API_KEY}`);
        const sDetails = await res.json();
        
        eSelect.innerHTML = '<option value="">Select Episode</option>';
        if(sDetails.episodes) {
            sDetails.episodes.forEach(ep => {
                const opt = document.createElement('option');
                opt.value = ep.episode_number;
                opt.innerText = `Ep ${ep.episode_number}: ${ep.name}`;
                eSelect.appendChild(opt);
            });
        }
    } catch(err) {
        eSelect.innerHTML = '<option value="">Error loading</option>';
    }
}

function toggleFormFields() {
    const status = document.getElementById('formStatus').value;
    document.getElementById('watchedFields').style.display = (status === 'watched' || status === 'inprogress') ? 'block' : 'none';
    document.getElementById('tvFields').style.display = (tempSelection && tempSelection.type === 'tv') ? 'flex' : 'none';
}

function updateStarsUI() {
    document.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('active', s.dataset.value <= currentRating);
    });
}

document.querySelectorAll('.star').forEach(star => {
    star.onclick = (e) => {
        currentRating = parseInt(e.target.dataset.value);
        updateStarsUI();
    };
});

function commitToLibrary() {
    if (!tempSelection) return;
    const entry = {
        ...tempSelection,
        status: document.getElementById('formStatus').value,
        rating: currentRating,
        review: document.getElementById('formReview').value,
        season: document.getElementById('formSeason').value,
        episode: document.getElementById('formEp').value
    };
    
    ['watchlist', 'inprogress', 'watched'].forEach(key => {
        myData[key] = myData[key].filter(i => i.id !== entry.id);
    });
    
    myData[entry.status].push(entry);
    localStorage.setItem('watchopedia_v8', JSON.stringify(myData));
    
    closeEditForm();
    showPage('homePage');
}

// --- EXPLORE LOGIC ---
async function getExplore() {
    const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${API_KEY}`);
    const data = await res.json();
    const grid = document.getElementById('exploreGrid');
    grid.innerHTML = '';
    data.results.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<img src="${IMG_PATH + item.poster_path}">`;
        card.onclick = () => showExploreDetail(item);
        grid.appendChild(card);
    });
}

async function showExploreDetail(item) {
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
    const data = await res.json();
    const itemData = JSON.stringify(item).replace(/'/g, "&apos;");

    document.getElementById('detailContent').innerHTML = `
        <h2 style="font-size:2rem; margin-bottom:10px;">${data.title || data.name}</h2>
        <p class="accent-text" style="margin-bottom:20px;">${data.genres ? data.genres.map(g=>g.name).join(' • ') : ''}</p>
        <div style="height: calc(100% - 150px);"><p style="font-size:0.9rem; line-height:1.8;">${data.overview}</p></div>
        <button class="save-btn" style="width:100%; margin-top:20px;" onclick='showPage("addPage"); selectForEdit(${itemData})'>Import to Curator</button>
    `;
}

showPage('homePage');
