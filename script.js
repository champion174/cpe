// ==========================================
// CONFIGURATION
// ==========================================
// Replace with your Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbwr6m2MO7X1XO2Z-mBkwxA1CqiyMTzyMCUrea99D6cVbobOT54_OW6s2NAY0njqH08V/exec"; 

const ERROR_REPORT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdVnD1ow5Vbln84CEl-HOLROE1HhJQD37uO9pwHKWyN2umSnQ/viewform?usp=pp_url&entry.309048385=REPLACE_ID";
const RATING_SUBMIT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSclZsoWAwAYuVi4CTZYcXQvTVLA9FlBarA2QtH3QzufHDJBmQ/viewform?usp=pp_url&entry.217150825=REPLACE_ID&entry.624495279=REPLACE_RATING";

let currentQuizData = [];
let userAnswers = {}; 
let currentQuestionIndex = 0;
let timerInterval;
let timeLeftRemaining = 0;
let chapterMetadata = {}; // NEW: Stores the map of Categories -> Chapters

// --- CORE HELPERS ---
function getCol(rowObj, targetName) {
    if (rowObj[targetName] !== undefined && rowObj[targetName] !== '') return rowObj[targetName];
    let cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let key in rowObj) {
        if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) return rowObj[key];
    }
    return '';
}

function parseContent(text, isReview = false) {
    if (!text || text === '') return '';
    let cleanText = String(text).trim();
    let maxWidth = isReview ? '150px' : '250px';
    if (cleanText.startsWith('http') && (cleanText.match(/\.(jpeg|jpg|gif|png)$/i) != null)) {
        return `<img src="${cleanText}" style="max-width: ${maxWidth}; border-radius: 6px; margin-top: 0.5rem; display: block; border: 1px solid #e2e8f0;">`;
    }
    return cleanText;
}

// --- INITIALIZATION & VIEW ROUTING ---
window.onload = async () => {
    try {
        let response = await fetch(API_URL + "?mode=metadata");
        chapterMetadata = await response.json(); 
        
        // Listen for category changes to update the chapters
        document.getElementById('category-filter').addEventListener('change', updateChapterDropdown);
        
        updateChapterDropdown(); // Populate initially
        showView('home'); 
    } catch (err) {
        document.getElementById('loading').innerHTML = "<h2>Error connecting to engine. Please refresh.</h2>";
    }
};

// --- NEW: DYNAMIC CHAPTER DROPDOWN ---
function updateChapterDropdown() {
    let catSelect = document.getElementById('category-filter').value;
    let chapSelect = document.getElementById('chapter-filter');
    chapSelect.innerHTML = '<option value="All">All Chapters Mix</option>';

    let chaptersToAdd = [];
    
    if (catSelect === "All") {
        // If "All Categories Mix", merge all chapters from every category
        Object.values(chapterMetadata).forEach(chaps => {
            chaptersToAdd = chaptersToAdd.concat(chaps);
        });
    } else if (chapterMetadata[catSelect]) {
        // Only get chapters for the selected category
        chaptersToAdd = chapterMetadata[catSelect];
    }

    // Remove duplicates and sort alphabetically
    let uniqueChapters = [...new Set(chaptersToAdd)].sort();

    uniqueChapters.forEach(chap => {
        chapSelect.innerHTML += `<option value="${chap}">${chap}</option>`;
    });
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    clearInterval(timerInterval); 
}

// --- SECURE DATA FETCHING ---
async function fetchQuizData(url) {
    document.getElementById('loading').innerHTML = "<h2>Generating your session...</h2>";
    showView('loading'); 
    try {
        let response = await fetch(url);
        currentQuizData = await response.json();
        return true;
    } catch (error) {
        document.getElementById('loading').innerHTML = "<h2>Error connecting to engine.</h2>";
        return false;
    }
}

// --- ENGINE MODES ---
async function startDaily5() {
    let success = await fetchQuizData(API_URL + "?mode=daily5");
    if (success) startQuizEngine(300); // 5 mins for daily 5
}

async function startCustomPractice() {
    let category = document.getElementById('category-filter').value;
    let chapter = document.getElementById('chapter-filter').value;
    let numQuestions = document.getElementById('num-questions').value;
    let timeLimitMins = document.getElementById('time-limit').value;

    let queryUrl = `${API_URL}?mode=custom&category=${encodeURIComponent(category)}&chapter=${encodeURIComponent(chapter)}&limit=${numQuestions}`;
    
    let success = await fetchQuizData(queryUrl);
    if (success) startQuizEngine(timeLimitMins * 60); 
}

// ... [Keep everything from startQuizEngine() downwards exactly as it is] ...

// --- ACTIVE QUIZ UI ---
function startQuizEngine(timeInSeconds) {
    if(currentQuizData.length === 0) { alert("No questions found for this selection."); showView('practice-setup'); return; }
    userAnswers = {}; currentQuestionIndex = 0; timeLeftRemaining = timeInSeconds;
    showView('quiz-ui'); renderQuestion(); startTimer();
}

// --- ACTIVE QUIZ UI ---
function startQuizEngine(timeInSeconds) {
    if(currentQuizData.length === 0) { alert("No questions found for this selection."); showView('practice-setup'); return; }
    userAnswers = {}; currentQuestionIndex = 0; timeLeftRemaining = timeInSeconds;
    showView('quiz-ui'); renderQuestion(); startTimer();
}

function renderQuestion() {
    let qData = currentQuizData[currentQuestionIndex];
    let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
    let qRating = getCol(qData, 'Difficulty Rating') || "Unrated";
    
    let qHTML = `<h3 style="margin-top: 0;">Q${currentQuestionIndex + 1}: ${parseContent(getCol(qData, 'Question Text'), false)}</h3>`;
    let extImage = getCol(qData, 'Image URL');
    if (extImage !== '') qHTML += `<img src="${extImage}" style="max-width: 100%; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;">`;
    
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
                let isSel = userAnswers[currentQuestionIndex] === opt ? 'selected' : '';
                optionsHTML += `<button class="option-btn ${isSel}" onclick="selectOption('${opt}')"><b>${opt}.</b> ${parseContent(optText, false)}</button>`;
            }
        });
    }
    container.innerHTML = optionsHTML;

    // THE FIX: Hide 'Previous' on Q1, hide 'Next' on the last question
    document.getElementById('prev-btn').style.visibility = (currentQuestionIndex === 0) ? 'hidden' : 'visible';
    document.getElementById('next-btn').style.visibility = (currentQuestionIndex === currentQuizData.length - 1) ? 'hidden' : 'visible';
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
        
        // Auto-submit if time runs out, regardless of what view they are on
        if (timeLeftRemaining <= 0) {
            calculateScore(); 
        }
    }, 1000);
}

// --- NEW PRE-SUBMIT REVIEW UI ---
function buildPreSubmitReview() {
    let listHTML = '';
    
    currentQuizData.forEach((qData, index) => {
        let userAns = userAnswers[index];
        let displayAns = userAns ? `<span style="color: var(--primary); font-weight: bold;">${userAns}</span>` : `<span style="color: var(--danger); font-weight: bold;">Unanswered</span>`;
        let qText = parseContent(getCol(qData, 'Question Text'), true); // use true to keep images small in review list
        
        listHTML += `
            <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1; padding-right: 1rem;">
                    <p style="margin: 0 0 0.5rem 0; font-size: 0.95rem;"><b>Q${index + 1}:</b> ${qText}</p>
                    <p style="margin: 0; font-size: 0.9rem;">Your Answer: ${displayAns}</p>
                </div>
                <button onclick="jumpToQuestion(${index})" style="background: #cbd5e1; color: var(--text); font-size: 0.85rem; padding: 0.4rem 0.8rem; height: fit-content;">Change</button>
            </div>
        `;
    });
    
    document.getElementById('pre-submit-list').innerHTML = listHTML;
    showView('pre-submit-review');
}

function jumpToQuestion(index) {
    currentQuestionIndex = index;
    renderQuestion();
    showView('quiz-ui');
}

// --- REVIEW & SCORING UI ---
function calculateScore() {
    clearInterval(timerInterval);
    let score = 0;
    let reviewHTML = '';

    currentQuizData.forEach((qData, index) => {
        let userAns = userAnswers[index] || "Unanswered";
        let rawCorrect = String(getCol(qData, 'Correct Answer')).trim();
        let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
        let qID = getCol(qData, 'Question ID') || `Unknown-Q${index}`; 
        
        let isCorrect = false;
        let correctAnsText = rawCorrect;
        let correctLetter = "None";

        // Determine the correct letter to match against the new logic
        if (qType !== 'FITB') {
            if (/^[A-D]$/i.test(rawCorrect)) {
                correctLetter = rawCorrect.toUpperCase();
                correctAnsText = String(getCol(qData, `Option ${correctLetter}`)).trim();
            } else {
                // Fallback: If you typed the full string in the DB instead of just the letter
                ['A', 'B', 'C', 'D'].forEach(opt => {
                    let optText = String(getCol(qData, `Option ${opt}`)).trim();
                    if (optText.toLowerCase() === rawCorrect.toLowerCase()) {
                        correctLetter = opt;
                        correctAnsText = optText;
                    }
                });
            }
            
            if (userAns === correctLetter) isCorrect = true;
            
        } else {
            // FITB still checks the exact typed string
            if (userAns.toString().trim().toLowerCase() === correctAnsText.toLowerCase()) isCorrect = true;
        }

        if (isCorrect) score++;

        let statusText = isCorrect 
            ? `<p class="result-status status-correct" style="margin-bottom: 0.5rem;">✓ Correct</p>`
            : `<p class="result-status status-incorrect" style="margin-bottom: 0.5rem;">✗ Incorrect</p>`;

        let optionsReviewHTML = '';
        if (qType !== 'FITB') {
            ['A', 'B', 'C', 'D'].forEach(opt => {
                let optText = getCol(qData, `Option ${opt}`);
                if (optText) {
                    let isUserChoice = (userAns === opt);
                    let isActualCorrect = (correctLetter === opt);
                    
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

        let rawExplanation = getCol(qData, 'Explanation');
        let explanationBlock = rawExplanation !== '' 
            ? `<div class="explanation-box" style="margin-top: 1rem; background: #e0f2fe; padding: 1rem; border-radius: 8px; font-size: 0.95rem; border: 1px solid #bae6fd;"><b>Explanation:</b><br>${parseContent(rawExplanation, false)}</div>` : '';

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
