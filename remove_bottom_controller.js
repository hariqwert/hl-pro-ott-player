const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

// 1. Remove the entire <footer id="maintenanceDeckBar">...</footer> and the pill
const footerStartStr = '<footer id="maintenanceDeckBar"';
const pillEndStr = '<span class="text-[10px] uppercase font-bold tracking-widest text-slate-200" id="reopenDeckBarTitle">Quantum Audio Deck</span>\n    </div>';

const footerStart = serverContent.indexOf(footerStartStr);
const pillEnd = serverContent.indexOf(pillEndStr);

if (footerStart !== -1 && pillEnd !== -1) {
    serverContent = serverContent.substring(0, footerStart) + serverContent.substring(pillEnd + pillEndStr.length);
}

// 2. Remove references to maintenanceDeckBar in window.openMusicPlayerCard and closeMusicPlayerCard
serverContent = serverContent.replace(
    /const maintenanceDeckBar = document.getElementById\('maintenanceDeckBar'\);\s*if \(maintenanceDeckBar\) maintenanceDeckBar.classList.add\('hidden'\);/g,
    ""
);

serverContent = serverContent.replace(
    /const maintenanceDeckBar = document.getElementById\('maintenanceDeckBar'\);\s*if \(maintenanceDeckBar\) maintenanceDeckBar.classList.remove\('hidden'\);/g,
    ""
);

fs.writeFileSync('server.ts', serverContent, 'utf8');
console.log('Removed bottom controller successfully!');
