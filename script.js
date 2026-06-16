// ==========================================
// CONFIGURATION
// ==========================================
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnhDcUEhGc5sh5NaCd0GTE6C9ceWyN-Zbvy8R27FOqkG6oODceGv4Wm3MZrAEzNWc2Jir9YclcPFAY/pub?gid=0&single=true&output=csv"; 

// Paste your pre-filled Google Form links here. 
// Keep the REPLACE_ID and REPLACE_RATING text exactly as is.
const ERROR_REPORT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdVnD1ow5Vbln84CEl-HOLROE1HhJQD37uO9pwHKWyN2umSnQ/viewform?usp=pp_url&entry.309048385=REPLACE_ID";
const RATING_SUBMIT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSclZsoWAwAYuVi4CTZYcXQvTVLA9FlBarA2QtH3QzufHDJBmQ/viewform?usp=pp_url&entry.217150825=REPLACE_ID&entry.624495279=REPLACE_RATING";

let masterDatabase = [];
let currentQuizData = [];
let userAnswers = {}; 
let currentQuestionIndex = 0;
let timerInterval;
let timeLeftRemaining = 0;

// --- CORE HELPERS ---
function getCol(rowObj, targetName) {
    if (rowObj[targetName] !== undefined && rowObj[targetName] !== '') return rowObj[targetName];
    let cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let key in rowObj) {
        if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) return rowObj[key];
    }
    return '';
}

function shuffleArray(array) {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Universal Content Parser: Checks if a string is an image link and renders it, otherwise returns text
function parseContent(text, isReview = false) {
    if (!text || text === '') return '';
    let cleanText = String(text).trim();
    let maxWidth = isReview ? '150px' : '250px';
    
    if (cleanText.startsWith('http') && (cleanText.match(/\.(jpeg|jpg|gif|png)$/i) != null)) {
        return `<img src="${cleanText}" style="max-width: ${maxWidth}; border-radius: 6px; margin-top: 0.5rem; display: block; border: 1px solid #e2e8f0;">`;
    }
    return cleanText;
}

// --- INITIALIZATION ---
window.onload = () => {
    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        transformHeader: function(h) { return h.trim(); }, 
        complete: function(results) {
            masterDatabase = results.data;
            showView('home'); 
        },
        error: function() {
            document.getElementById('loading').innerHTML = "<h2>Error loading database.</h2>";
        }
    });
};

function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    clearInterval(timerInterval); 
}

// --- ENGINE MODES ---
function startDaily5() {
    let validDB = masterDatabase.filter(q => getCol(q, 'Question Text').trim() !== '' || getCol(q, 'Image URL').trim() !== '');
    let organic = validDB.filter(q => getCol(q, 'Category') === "Organic");
    let physical = validDB.filter(q => getCol(q, 'Category') === "Physical");
    let inorganic = validDB.filter(q => getCol(q, 'Category') === "Inorganic");
    let aptitude = validDB.filter(q => getCol(q, 'Category') === "Aptitude");

    let selected = [];
    if (organic.length > 0) selected.push(shuffleArray(organic)[0]);
    if (physical.length > 0) selected.push(shuffleArray(physical)[0]);
    if (inorganic.length > 0) selected.push(shuffleArray(inorganic)[0]);
    if (aptitude.length > 0) selected.push(shuffleArray(aptitude)[0]);

    let remaining = shuffleArray(validDB.filter(q => !selected.includes(q)));
    while (selected.length < 5 && remaining.length > 0) selected.push(remaining.pop());

    currentQuizData = shuffleArray(selected);
    startQuizEngine(300); 
}

function startCustomPractice() {
    let validDB = masterDatabase.filter(q => getCol(q, 'Question Text').trim() !== '' || getCol(q, 'Image URL').trim() !== '');
    let category = document.getElementById('category-filter').value;
    let pool = (category === "All") ? validDB : validDB.filter(q => getCol(q, 'Category') === category);
    currentQuizData = shuffleArray(pool).slice(0, 10);
    startQuizEngine(600); 
}

// --- ACTIVE QUIZ UI ---
function startQuizEngine(timeInSeconds) {
    if(currentQuizData.length === 0) { alert("No questions found."); return; }
    userAnswers = {}; currentQuestionIndex = 0; timeLeftRemaining = timeInSeconds;
    showView('quiz-ui'); renderQuestion(); startTimer();
}

function renderQuestion() {
    let qData = currentQuizData[currentQuestionIndex];
    let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
    let q = getCol(qData, 'Difficulty ') || "Unrated";
    
    // Parse Questions & Images universally
    let qHTML = `<h3 style="margin-top: 0;">Q${currentQuestionIndex + 1}: ${parseContent(getCol(qData, 'Question Text'), false)}</h3>`;
    let extImage = getCol(qData, 'Image URL');
    if (extImage !== '') qHTML += `<img src="${extImage}" style="max-width: 100%; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;">`;
    
    // Display Difficulty 
    qHTML += `<div style="display: inline-block; background: #f1f5f9; color: #64748b; font-size: 0.85rem; padding: 0.25rem 0.75rem; border-radius: 12px; margin-bottom: 1.5rem; font-weight: bold;">⭐ Difficulty Rating: ${qRating}</div>`;
    
    document.getElementById('question-text').innerHTML = qHTML;
    
    let container = document.getElementById('options-container');
    let optionsHTML = '';
    
    if (qType === 'FITB') {
        let currentAns = userAnswers[currentQuestionIndex] || '';
        optionsHTML = `<input type="text" class="fitb-input" placeholder="Type answer..." value="${currentAns}" onkeyup="selectFITB(this.value)">`;
    } else {
        ['A', 'B', 'C', 'D'].forEach(opt => {
            let optText = getCol(qData, `Option ${opt}`);
            if (optText) {
                let isSel = userAnswers[currentQuestionIndex] === optText ? 'selected' : '';
                optionsHTML += `<button class="option-btn ${isSel}" onclick="selectOption('${optText}')"><b>${opt}.</b> ${parseContent(optText, false)}</button>`;
            }
        });
    }
    container.innerHTML = optionsHTML;
}

function selectOption(t) { userAnswers[currentQuestionIndex] = t; renderQuestion(); }
function selectFITB(t) { userAnswers[currentQuestionIndex] = t; }
function prevQuestion() { if (currentQuestionIndex > 0) { currentQuestionIndex--; renderQuestion(); } }
function nextQuestion() { if (currentQuestionIndex < currentQuizData.length - 1) { currentQuestionIndex++; renderQuestion(); } }

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeftRemaining--;
        let m = Math.floor(timeLeftRemaining / 60), s = timeLeftRemaining % 60;
        document.getElementById('time').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (timeLeftRemaining <= 0) calculateScore(); 
    }, 1000);
}

function showReview() { if(confirm("Submit answers?")) calculateScore(); }

// --- REVIEW & SCORING UI ---
function calculateScore() {
    clearInterval(timerInterval);
    let score = 0;
    let reviewHTML = '';

    currentQuizData.forEach((qData, index) => {
        let userAns = userAnswers[index] || "Unanswered";
        let rawCorrect = String(getCol(qData, 'Correct Answer')).trim();
        let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
        let qID = getCol(qData, 'Question ID') || `Unknown-Q${index}`; // Fallback if no ID is assigned
        
        let correctAnsText = /^[A-D]$/i.test(rawCorrect) ? String(getCol(qData, `Option ${rawCorrect.toUpperCase()}`)).trim() : rawCorrect;
        let isCorrect = userAns.toString().trim().toLowerCase() === correctAnsText.toLowerCase();
        if (isCorrect) score++;

        let statusText = isCorrect 
            ? `<p class="result-status status-correct" style="margin-bottom: 0.5rem;">✓ Correct</p>`
            : `<p class="result-status status-incorrect" style="margin-bottom: 0.5rem;">✗ Incorrect</p>`;

        let optionsReviewHTML = '';
        if (qType !== 'FITB') {
            ['A', 'B', 'C', 'D'].forEach(opt => {
                let optText = getCol(qData, `Option ${opt}`);
                if (optText) {
                    let cleanUser = userAns.toString().trim().toLowerCase();
                    let cleanCorrect = correctAnsText.toString().trim().toLowerCase();
                    let cleanOpt = optText.toString().trim().toLowerCase();

                    let isUserChoice = (cleanUser === cleanOpt);
                    let isActualCorrect = (cleanCorrect === cleanOpt);
                    
                    let bgStyle = isActualCorrect ? 'background: #dcfce7; border: 1px solid #22c55e; color: #15803d; font-weight: bold;' 
                                : (isUserChoice && !isActualCorrect) ? 'background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c;' 
                                : 'background: transparent; border: 1px solid #e2e8f0; color: #0f172a;';
                    let icon = isActualCorrect ? ' ✓' : (isUserChoice ? ' (Your Answer)' : '');

                    optionsReviewHTML += `<div style="${bgStyle} padding: 0.5rem; margin-top: 0.25rem; border-radius: 6px; font-size: 0.95rem;">${opt}. ${parseContent(optText, true)} ${icon}</div>`;
                }
            });
        } else {
            optionsReviewHTML = `<div style="background: #f8fafc; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem;"><p style="margin: 0; color: #64748b;">Your Answer: <b>${userAns}</b></p><p style="margin: 0.25rem 0 0 0; color: #15803d;">Correct Answer: <b>${correctAnsText}</b></p></div>`;
        }

        // Parse Universal Images in Explanation
        let rawExplanation = getCol(qData, 'Explanation');
        let explanationBlock = rawExplanation !== '' 
            ? `<div class="explanation-box" style="margin-top: 1rem; background: #e0f2fe; padding: 1rem; border-radius: 8px; font-size: 0.95rem; border: 1px solid #bae6fd;"><b>Explanation:</b><br>${parseContent(rawExplanation, false)}</div>` : '';

        // Dynamic Action Links
        let reportLink = ERROR_REPORT_FORM.replace('REPLACE_ID', encodeURIComponent(qID));
        
        let ratingHTML = `
            <div style="margin-top: 1.5rem; border-top: 1px solid #e2e8f0; padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 0.9rem; color: #64748b; margin-right: 0.5rem;">Rate Difficulty:</span>
                    ${[1,2,3,4,5].map(star => `<a href="${RATING_SUBMIT_FORM.replace('REPLACE_ID', encodeURIComponent(qID)).replace('REPLACE_RATING', star)}" target="_blank" style="text-decoration: none; font-size: 1.2rem; cursor: pointer;" title="Rate ${star} Stars">⭐</a>`).join('')}
                </div>
                <a href="${reportLink}" target="_blank" style="color: #ef4444; font-size: 0.85rem; text-decoration: underline; font-weight: bold;">Report Error in Question</a>
            </div>
        `;

        let qTextDisplay = parseContent(getCol(qData, 'Question Text'), false);
        let qImage = getCol(qData, 'Image URL');
        if (qImage !== '') qTextDisplay += `<img src="${qImage}" style="max-width: 100%; border-radius: 8px; margin-top: 1rem; display: block; border: 1px solid #e2e8f0;">`;

        reviewHTML += `
            <div class="result-card" style="background: #f8fafc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border-left: 6px solid ${isCorrect ? '#22c55e' : '#ef4444'};">
                <p class="result-question" style="font-weight: 600; font-size: 1.1rem; margin-top: 0;">Q${index + 1} <span style="color: #94a3b8; font-size: 0.8rem;">[${qID}]</span>: ${qTextDisplay}</p>
                ${statusText} ${optionsReviewHTML} ${explanationBlock} ${ratingHTML}
            </div>
        `;
    });

    document.getElementById('score-display').innerText = `You scored ${score} out of ${currentQuizData.length}`;
    document.getElementById('review-container').innerHTML = reviewHTML;
    showView('results');
}
