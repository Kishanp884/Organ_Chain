// ======= CONFIG =======
const CONTRACT_ADDRESS = "0x8469799c03f57DefF0a5aF9B10c52B06c335C817"; // e.g. "0x1234..."
const CONTRACT_ABI =[
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_organId",
				"type": "string"
			}
		],
		"name": "confirmTransplant",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "organId",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "status",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "eventDescription",
				"type": "string"
			}
		],
		"name": "OrganStatusUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "string",
				"name": "organId",
				"type": "string"
			}
		],
		"name": "OrganTransplanted",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_organId",
				"type": "string"
			},
			{
				"internalType": "int256",
				"name": "_lat",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "_lng",
				"type": "int256"
			}
		],
		"name": "procureOrgan",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_organId",
				"type": "string"
			},
			{
				"internalType": "int256",
				"name": "_lat",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "_lng",
				"type": "int256"
			}
		],
		"name": "updateLocation",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "organs",
		"outputs": [
			{
				"internalType": "string",
				"name": "status",
				"type": "string"
			},
			{
				"components": [
					{
						"internalType": "int256",
						"name": "lat",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "lng",
						"type": "int256"
					}
				],
				"internalType": "struct OrganChain.Location",
				"name": "currentLocation",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_organId",
				"type": "string"
			}
		],
		"name": "viewOrganDetails",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "int256",
				"name": "",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "",
				"type": "int256"
			},
			{
				"internalType": "string[]",
				"name": "",
				"type": "string[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

// Sepolia chain params (for auto-switch)
const SEPOLIA = {
  chainId: "0xaa36a7",
  chainName: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"]
};

// ======= STATE =======
let provider, signer, contract;
const organsState = new Map(); // organId -> { status, lat, lng, auditTrail[] }

// ======= DOM =======
const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

const toast = (msg, ok=false) => {
  const el = $("#toast");
  el.textContent = msg;
  el.style.borderColor = ok ? "rgba(22,163,74,.6)" : "rgba(220,38,38,.6)";
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 2600);
};

// ======= ETH HELPERS =======
function toMicro(v){ return Math.round(Number(v) * 1e6); }
function fromMicro(v){ return Number(v) / 1e6; }

async function connect() {
  if (!window.ethereum) {
    toast("MetaMask not found. Install it first."); return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(SEPOLIA.chainId)) {
      // try to switch
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA.chainId }]});
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA] });
        } else { throw e; }
      }
    }
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    $("#networkTag").textContent = "Connected: Sepolia";
    $("#btnConnect").textContent = (await signer.getAddress()).slice(0,6)+"…"+(await signer.getAddress()).slice(-4);
    toast("Wallet connected", true);
  } catch (err) {
    console.error(err);
    toast(err.message || "Failed to connect");
  }
}

// ======= CONTRACT CALLS =======
async function procure() {
  if (!contract) return toast("Connect wallet first");
  const id = $("#p_id").value.trim();
  const lat = $("#p_lat").value.trim();
  const lng = $("#p_lng").value.trim();
  if (!id || !lat || !lng) return toast("All fields required");
  try {
    const tx = await contract.procureOrgan(id, toMicro(lat), toMicro(lng));
    toast("Submitting procure tx…", true);
    await tx.wait();
    toast("Procured ✅", true);
    // reflect locally
    organsState.set(id, { status: "Procured", lat: Number(lat), lng: Number(lng), auditTrail: ["Organ procured and tokenized."] });
    renderLists();
    plotPins();
  } catch (e) { console.error(e); toast(e.shortMessage || e.message); }
}

async function updateLocation() {
  if (!contract) return toast("Connect wallet first");
  const id = $("#u_id").value.trim();
  const lat = $("#u_lat").value.trim();
  const lng = $("#u_lng").value.trim();
  if (!id || !lat || !lng) return toast("All fields required");
  try {
    const tx = await contract.updateLocation(id, toMicro(lat), toMicro(lng));
    toast("Submitting update tx…", true);
    await tx.wait();
    toast("Location updated ✅", true);
    // optimistic refresh
    const rec = organsState.get(id) || { status: "In Transit", auditTrail: [] };
    rec.lat = Number(lat); rec.lng = Number(lng);
    rec.status = rec.status === "Transplanted" ? "Transplanted" : "In Transit";
    rec.auditTrail = rec.auditTrail || [];
    rec.auditTrail.push(`Location updated to (${lat}, ${lng}).`);
    organsState.set(id, rec);
    renderLists();
    plotPins();
  } catch (e) { console.error(e); toast(e.shortMessage || e.message); }
}

async function confirmTransplant() {
  if (!contract) return toast("Connect wallet first");
  const id = $("#t_id").value.trim();
  if (!id) return toast("Organ ID required");
  try {
    const tx = await contract.confirmTransplant(id);
    toast("Submitting confirm tx…", true);
    await tx.wait();
    toast("Transplant confirmed ✅", true);
    const rec = organsState.get(id) || { auditTrail: [] };
    rec.status = "Transplanted";
    rec.auditTrail = rec.auditTrail || [];
    rec.auditTrail.push("Transplant confirmed.");
    organsState.set(id, rec);
    renderLists();
    plotPins();
  } catch (e) { console.error(e); toast(e.shortMessage || e.message); }
}

async function viewDetails(idInput) {
  if (!contract) return toast("Connect wallet first");
  const id = (idInput || $("#v_id").value.trim());
  if (!id) return toast("Organ ID required");
  try {
    const [status, latI, lngI, trail] = await contract.viewOrganDetails(id);
    const lat = fromMicro(latI); const lng = fromMicro(lngI);
    organsState.set(id, { status, lat, lng, auditTrail: Array.from(trail) });
    // UI
    $("#viewResult").innerHTML = `
      <div><b>Status:</b> ${status || "<i>Not found</i>"}</div>
      <div><b>Location:</b> ${isNaN(lat) ? "-" : lat.toFixed(6)}, ${isNaN(lng) ? "-" : lng.toFixed(6)}</div>
      <div><b>Audit:</b>
        <ul>${(trail || []).map(x=>`<li>${x}</li>`).join("")}</ul>
      </div>`;
    renderLists();
    plotPins();
    return { status, lat, lng, trail };
  } catch (e) { console.error(e); toast(e.shortMessage || e.message); }
}

// ======= UI LOGIC =======
function renderLists() {
  const filter = document.querySelector(".tab.active")?.dataset.filter || "all";
  const holder = $("#organsGrid");
  holder.innerHTML = "";

  let total=0, transit=0, transplanted=0, critical=0;

  organsState.forEach((v, id) => {
    total++;
    if (v.status === "In Transit") transit++;
    if (v.status === "Transplanted") transplanted++;
    if (v.status === "Critical") critical++;

    if (filter !== "all" && v.status !== filter) return;

    const card = document.createElement("div");
    card.className = "organ-card";
    const badgeClass =
      v.status === "Transplanted" ? "badge-green" :
      v.status === "In Transit" ? "badge-amber" :
      v.status === "At Hospital" ? "badge-blue" :
      v.status === "Critical" ? "badge-red" : "badge-blue";

    card.innerHTML = `
      <div><span class="organ-id">${id}</span>
      <span class="badge ${badgeClass}">${v.status || "Unknown"}</span></div>
      <div class="card-row">
        <span>Lat: ${isFinite(v.lat) ? v.lat.toFixed(5) : "-"}</span>
        <span>Lng: ${isFinite(v.lng) ? v.lng.toFixed(5) : "-"}</span>
      </div>
      <div class="card-row"><span>Audit entries</span><span>${(v.auditTrail||[]).length}</span></div>
      <div class="card-row"><button class="btn btn-dark" data-view="${id}">View</button></div>
    `;
    holder.appendChild(card);
  });

  $("#emptyState").style.display = holder.children.length ? "none" : "block";
  $("#kpiTotal").textContent = total;
  $("#kpiTransit").textContent = transit;
  $("#kpiTransplanted").textContent = transplanted;
  $("#kpiCritical").textContent = critical;
  $("#activeShipments").textContent = `${transit} active shipments`;
}

function activateTabs() {
  $$(".tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      $$(".tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      renderLists();
    });
  });
}

function attachDelegates() {
  $("#organsGrid").addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    const id = btn.getAttribute("data-view");
    $("#v_id").value = id;
    viewDetails(id);
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Very simple SVG “map”: plots pins using lat/lng normalized to world bounds.
const world = { minLat: -85, maxLat: 85, minLng: -180, maxLng: 180 };
function latLngToSvg(lat,lng) {
  const x = ((lng - world.minLng) / (world.maxLng - world.minLng)) * 1000;
  const y = ((world.maxLat - lat) / (world.maxLat - world.minLat)) * 560;
  return { x, y };
}
function plotPins() {
  const svg = $("#mapSvg");
  svg.innerHTML = ""; // clear
  // grid background
  for (let i=0;i<=10;i++){
    const vline = document.createElementNS("http://www.w3.org/2000/svg","line");
    vline.setAttribute("x1", (i*100).toString()); vline.setAttribute("x2", (i*100).toString());
    vline.setAttribute("y1","0"); vline.setAttribute("y2","560");
    vline.setAttribute("stroke","#1f2a44"); vline.setAttribute("stroke-width","1");
    svg.appendChild(vline);
    const hline = document.createElementNS("http://www.w3.org/2000/svg","line");
    hline.setAttribute("y1", (i*56).toString()); hline.setAttribute("y2", (i*56).toString());
    hline.setAttribute("x1","0"); hline.setAttribute("x2","1000");
    hline.setAttribute("stroke","#1f2a44"); hline.setAttribute("stroke-width","1");
    svg.appendChild(hline);
  }
  organsState.forEach((v,id)=>{
    if (!isFinite(v.lat) || !isFinite(v.lng)) return;
    const {x,y} = latLngToSvg(v.lat, v.lng);
    const g = document.createElementNS("http://www.w3.org/2000/svg","g");
    const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1));
    c.setAttribute("r","8");
    const color =
      v.status==="Transplanted" ? "#16a34a" :
      v.status==="In Transit" ? "#d97706" : "#2563eb";
    c.setAttribute("fill", color);
    const label = document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x",(x+12).toFixed(1)); label.setAttribute("y",(y+4).toFixed(1));
    label.setAttribute("fill","#cbd5e1"); label.setAttribute("font-size","12");
    label.textContent = id;
    g.appendChild(c); g.appendChild(label);
    svg.appendChild(g);
  });
  $("#activeShipments").textContent = `${[...organsState.values()].filter(o=>o.status==="In Transit").length} active shipments`;
}

// ======= WIRE UP =======
window.addEventListener("load", ()=>{
  activateTabs();
  attachDelegates();

  $("#btnConnect").addEventListener("click", connect);
  $("#btnProcure").addEventListener("click", procure);
  $("#btnUpdate").addEventListener("click", updateLocation);
  $("#btnTransplant").addEventListener("click", confirmTransplant);
  $("#btnView").addEventListener("click", ()=>viewDetails());

  $("#btnSearch").addEventListener("click", ()=>viewDetails($("#searchInput").value.trim()));

  // Re-render after any state change
  renderLists();
  plotPins();

  // Listen to contract events if connected later
  if (window.ethereum) {
    window.ethereum.on?.("chainChanged", ()=>location.reload());
    window.ethereum.on?.("accountsChanged", ()=>location.reload());
  }
});

// Optional: If you want live updates after connect (event listeners).
async function attachEvents() {
  if (!contract) return;
  contract.on("OrganStatusUpdated", (organId, status, desc) => {
    // Fetch fresh details for that organId
    viewDetails(organId).then(()=>toast(`Status updated: ${organId} → ${status}`, true));
  });
  contract.on("OrganTransplanted", (organId) => {
    viewDetails(organId).then(()=>toast(`Transplanted: ${organId}`, true));
  });
}

// Call attachEvents after connect succeeds
(async ()=>{
  // Poll for connection then attach events
  const iv = setInterval(()=>{
    if (contract){ attachEvents(); clearInterval(iv); }
  }, 1000);
})();
