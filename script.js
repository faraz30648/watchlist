const API_KEY = '0010a32a4e1e60188f2036b82b0a8a1b';
const IMG_PATH = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_PATH = 'https://image.tmdb.org/t/p/w1280';

let myData = JSON.parse(localStorage.getItem('watchopedia_v6')) || { watchlist: [], inprogress: [], watched: [] };
let tempSelection = null;
let currentRating = 0;

function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
    if(pageId === 'homePage') renderHome();
    if(pageId === 'explorePage') getExplore();
}

// --- HOME PAGE (3 SECTIONS) ---
function renderHome() {
    const draw = (list, id, nextStatus, btnText) => {
        const el = document.getElementById(id);
        el.innerHTML = list.length ? '' : '<p style="color:#222">Empty.</p>';
        list.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${IMG_PATH + item.poster}" onclick='openHomeDetail(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                ${btnText ? `<button class="card-btn" onclick='changeStatus(${item.id}, "${item.status}", "${nextStatus}")'>${btnText}</button>` : ''}
            `;
            el.appendChild(card);
        });
    };
    draw(myData.watchlist, 'homeWatchlist', 'inprogress', 'START WATCHING');
    draw(myData.inprogress, 'homeInProgress', 'watched', 'MARK AS DONE');
    draw(myData.watched, 'homeWatched', null, null);
}

function changeStatus(id, oldStatus, newStatus) {
    const itemIndex = myData[oldStatus].findIndex(i => i.id === id);
    const item = myData[oldStatus].splice(itemIndex, 1)[0];
    item.status = newStatus;
    myData[newStatus].push(item);
    localStorage.setItem('watchopedia_v6', JSON.stringify(myData));
    renderHome();
}

function openHomeDetail(item) {
    document.getElementById('modalHero').style.backgroundImage = `url(${BACKDROP_PATH + item.backdrop})`;
    document.getElementById('hTitle').innerText = item.title;
    document.getElementById('hMeta').innerText = `${item.genres} • ${item.type.toUpperCase()}`;
    document.getElementById('hPlot').innerText = item.overview;
    document.getElementById('hCast').innerText = item.cast;

    const journal = document.getElementById('hJournal');
    journal.innerHTML = item.status === 'watched' ? 
        `<h3>Archive Entry</h3><p>Rating: ${'★'.repeat(item.rating)}</p><p>${item.review}</p>` : 
        `<p class="accent-text">Status: ${item.status === 'inprogress' ? 'In Progress' : 'Yet to Watch'}</p>`;

    document.getElementById('homeDetailModal').style.display = 'block';
}

function closeHomeDetail() { document.getElementById('homeDetailModal').style.display = 'none'; }

// --- CONSOLIDATED ADD NEW SEARCH LOGIC ---
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
    adminSearchResults.style.display = 'block';

    data.results.slice(0, 5).forEach(item => {
        const div = document.createElement('div');
        div.className = 'search-item';
        div.innerText = item.title || item.name;
        div.onclick = () => {
            selectForEdit(item);
            adminSearchResults.style.display = 'none';
            adminSearch.value = ''; // Optional: clear search after selection
        };
        adminSearchResults.appendChild(div);
    });
});

async function selectForEdit(item) {
    const type = item.media_type || (item.title ? 'movie' : 'tv');
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&append_to_response=credits`);
    const details = await res.json();

    tempSelection = {
        id: item.id, title: item.title || item.name, poster: item.poster_path, backdrop: item.backdrop_path,
        type: type, overview: item.overview, cast: details.credits.cast.slice(0,5).map(c=>c.name).join(', '),
        genres: details.genres.map(g=>g.name).join(', ')
    };

    document.getElementById('editForm').style.display = 'block';
    document.getElementById('editTitle').innerText = tempSelection.title;
    document.getElementById('editPoster').src = IMG_PATH + tempSelection.poster;
    adminSearchResults.innerHTML = '';
    toggleFormFields();
}

function toggleFormFields() {
    const status = document.getElementById('formStatus').value;
    document.getElementById('watchedFields').style.display = (status === 'watched' || status === 'inprogress') ? 'block' : 'none';
    document.getElementById('tvFields').style.display = (tempSelection && tempSelection.type === 'tv') ? 'block' : 'none';
}

// --- STAR RATING LOGIC ---
document.querySelectorAll('.star').forEach(star => {
    star.onclick = (e) => {
        currentRating = e.target.dataset.value;
        document.querySelectorAll('.star').forEach(s => {
            s.classList.toggle('active', s.dataset.value <= currentRating);
        });
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
    localStorage.setItem('watchopedia_v6', JSON.stringify(myData));
    alert("Collection updated.");
    showPage('homePage');
}

// --- EXPLORE PAGE ---
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
        <p class="accent-text" style="margin-bottom:20px;">${data.genres.map(g=>g.name).join(' • ')}</p>
        <p style="font-size:0.9rem; line-height:1.8; margin-bottom:30px;">${data.overview}</p>
        <button class="save-btn" style="width:100%" onclick='showPage("addPage"); selectForEdit(${itemData})'>Import to Curator</button>
    `;
}

// Start on home page
showPage('homePage');
