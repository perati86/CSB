let disciplineCodes = {};
let athleteResults = [];
const teamShortNames = [];
const teamFullNames = [];

document.addEventListener("DOMContentLoaded", () => {
    loadDisciplineKeys();
});

async function loadDisciplineKeys() {
    try {
        const response = await fetch("disciplineCodes.json");
        if (!response.ok) {
            throw new Error(`Failed to load disciplineCodes.json: ${response.status}`);
        }

        disciplineCodes = await response.json();
        const eventSelect = document.getElementById("event");
        if (!eventSelect) {
            console.warn("Event select not found");
            return;
        }

        Object.keys(disciplineCodes).forEach((key) => {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = key;
            eventSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading discipline keys:", error);
    }
}

async function getHtmlDocumentFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load URL ${url}: ${response.status}`);
    }

    const html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
}

function findTeamChampsRows(doc) {
    const headers = [...doc.querySelectorAll("h3")].filter(
        (h3) => h3.textContent.trim() === "Eredmények"
    );

    for (const header of headers) {
        let next = header.nextElementSibling;
        while (next) {
            if (next.tagName === "TABLE") {
                return [...next.querySelectorAll("tr")].filter(
                    (row) => !row.querySelector("th")
                );
            }
            next = next.nextElementSibling;
        }
    }

    return [];
}

function orderAthleteResults(results, isTrackEvent) {
    return [...results];
}

function updateResultsTable(results) {
    const tbody = document.querySelector("#results tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!results.length) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.setAttribute("colspan", "5");
        emptyCell.textContent = "Nincs adat";
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }

    results.forEach((result, index) => {
        const row = document.createElement("tr");
        [
            index + 1,
            result.Name,
            result.Club,
            result.BirthYear,
            result.Result,
            result.Score,
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

async function search() {
    const year = document.getElementById("year")?.value;
    const selectedDisciplineName = document.getElementById("event")?.value;

    if (!selectedDisciplineName || !year) {
        alert("Kérlek válassz ki egy versenyszámot és egy évet.");
        return;
    }

    const selectedDiscipline = disciplineCodes[selectedDisciplineName];
    if (!selectedDiscipline) {
        alert("A kiválasztott versenyszám nem található.");
        return;
    }

    const toplistUrl = `https://apps.atletika.hu/opentoplist/top-list?web2=1&vsz=${selectedDiscipline}&ev=${year}&ko=8`;
    const teamChampsUrlD3 = `http://csb.masz.hu/${parseInt(year, 10) - 1}/D3/versenyszam/${selectedDiscipline}`;
    const teamChampsUrlD2 = `http://csb.masz.hu/${parseInt(year, 10) - 1}/D2/versenyszam/${selectedDiscipline}`;

    try {
        const topListDoc = await getHtmlDocumentFromUrl(toplistUrl);
        const teamChampsDocD2 = await getHtmlDocumentFromUrl(teamChampsUrlD2);
        const teamChampsDocD3 = await getHtmlDocumentFromUrl(teamChampsUrlD3);

        const headerCells = [...topListDoc.querySelectorAll("thead tr th")];
        const toplistRows = [...topListDoc.querySelectorAll("tbody tr")];
        const teamsChampsRowsD2 = findTeamChampsRows(teamChampsDocD2);
        const teamsChampsRowsD3 = findTeamChampsRows(teamChampsDocD3);
        const teamChampsRows = [...teamsChampsRowsD2, ...teamsChampsRowsD3];

        console.log("Data loaded successfully:", {
            toplistRowsCount: toplistRows.length,
            teamChampsRowsCount: teamChampsRows.length,
        });

        if (!toplistRows.length || !teamChampsRows.length) {
            updateResultsTable([]);
            return;
        }

        const results = [];
        const nameIndex = headerCells.findIndex(
            (h) => h.textContent.trim() === "Atléta"
        );
        const birthIndex = headerCells.findIndex(
            (h) => h.textContent.trim() === "Szül"
        );
        const clubIndex = headerCells.findIndex(
            (h) => h.textContent.trim() === "Klub"
        );

        if (nameIndex === -1 || birthIndex === -1 || clubIndex === -1) {
            alert("A HTML struktúrája megváltozott, nem találhatóak a szükséges oszlopok.");
            return;
        }

        const isRelay = selectedDisciplineName.includes("x") === true;

        if (!isRelay) {
            toplistRows.forEach((row) => {
                const cells = [...row.querySelectorAll("td")];
                const birthYear = parseInt(cells[birthIndex]?.textContent.trim(), 10);
                const club = cells[clubIndex]?.textContent.trim() || "";

                if (
                    (birthYear < 40 && new Date().getFullYear() - birthYear < 2016) ||
                    !teamShortNames.includes(club)
                ) {
                    return;
                }

                const teamIndex = teamShortNames.indexOf(club);
                if (cells.length >= 7) {
                    results.push({
                        Name: cells[nameIndex]?.textContent.trim() || "",
                        Club: teamFullNames[teamIndex] || club,
                        BirthYear: cells[birthIndex]?.textContent.trim() || "",
                        Result: cells[0]?.textContent.trim() || "",
                    });
                }
            });
        }

        const birthTeamIndex = isRelay ? 5 : 2;
        const clubTeamIndex = isRelay ? 2 : 3;
        const resultTeamIndex = isRelay ? 3 : 4;

        teamChampsRows.forEach((row) => {
            const cells = [...row.querySelectorAll("td")];
            const club = cells[clubTeamIndex]?.textContent.trim() || "";

            if (!teamFullNames.includes(club)) {
                return;
            }

            if (cells.length >= 7) {
                const result = {
                    Name: cells[1]?.textContent.trim() || "",
                    Club: club,
                    BirthYear: isRelay ? "" : cells[birthTeamIndex]?.textContent.trim().substring(2, 4) || "",
                    Result: cells[resultTeamIndex]?.textContent.trim() || "",
                };

                if (!results.some((r) => r.Name === result.Name && r.BirthYear === result.BirthYear)) {
                    results.push(result);
                }
            }
        });

        const isTrackEvent = /\d/.test(selectedDisciplineName);
        athleteResults = orderAthleteResults(results, isTrackEvent);

        athleteResults.forEach((result, index) => {
            result.Score = Math.max(16 - index, 0);
        });

        updateResultsTable(athleteResults);
    } catch (error) {
        console.error("Search failed:", error);
        alert("A keresés során hiba történt. Ellenőrizd a konzolt a részletekért.");
    }
}

function calculateScores() {
    const table = document.getElementById("scoreTable");

    if (!table) {
        console.warn("scoreTable not found");
        return;
    }

    table.classList.remove("hidden");
    console.log("Pontszámítás");

    // TODO:
    // Pontszámítás logika
}
