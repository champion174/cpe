// ==========================================
// CONFIGURATION
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbwr6m2MO7X1XO2Z-mBkwxA1CqiyMTzyMCUrea99D6cVbobOT54_OW6s2NAY0njqH08V/exec"; 
const ERROR_REPORT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdVnD1ow5Vbln84CEl-HOLROE1HhJQD37uO9pwHKWyN2umSnQ/viewform?usp=pp_url&entry.309048385=REPLACE_ID";
const RATING_SUBMIT_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSclZsoWAwAYuVi4CTZYcXQvTVLA9FlBarA2QtH3QzufHDJBmQ/viewform?usp=pp_url&entry.217150825=REPLACE_ID&entry.624495279=REPLACE_RATING";

let currentQuizData = [];
let userAnswers = {}; // For MSQ, this will store an array: ["A", "C"]
let currentQuestionIndex = 0;
let timerInterval;
let timeLeftRemaining = 0;
let chapterMetadata = {}; 

// --- CORE HELPERS ---
function getCol(rowObj, targetName) {
    if (rowObj[targetName] !== undefined && rowObj[targetName] !== '') return rowObj[targetName];
    let cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let key in rowObj) {
        if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) return rowObj[key];
    }
    return '';
}

function parseContent(text, customMaxWidth = '250px') {
    if (!text || text === '') return '';
    let cleanText = String(text).trim();
    let isStandardImage = cleanText.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
    let isGithubAsset = cleanText.includes('github.com/user-attachments/assets/');
    if (cleanText.startsWith('http') && (isStandardImage || isGithubAsset)) {
        return `<img src="${cleanText}" style="max-width: ${customMaxWidth}; height: auto; border-radius: 6px; margin-top: 0.5rem; display: block; border: 1px solid #e2e8f0;">`;
    }
    return cleanText;
}

// --- INITIALIZATION & DROPDOWNS ---
window.onload = async () => {
    try {
        let response = await fetch(API_URL + "?mode=metadata");
        let data = await response.json(); 
        chapterMetadata = data.categoryMap; 
        
        let examSelect = document.getElementById('exam-filter');
        data.exams.sort().forEach(ex => examSelect.innerHTML += `<option value="${ex}">${ex}</option>`);
        
        let partSelect = document.getElementById('part-filter');
        data.parts.sort().forEach(pt => partSelect.innerHTML += `<option value="${pt}">${pt}</option>`);

        let catSelect = document.getElementById('category-filter');
        data.categories.sort().forEach(cat => catSelect.innerHTML += `<option value="${cat}">${cat}</option>`);
        
        document.getElementById('category-filter').addEventListener('change', updateChapterDropdown);
        updateChapterDropdown(); 
        showView('home'); 
    } catch (err) {
        document.getElementById('loading').innerHTML = "<h2>Error connecting to engine. Please refresh.</h2>";
    }
};

function updateChapterDropdown() {
    let catSelect = document.getElementById('category-filter').value;
    let chapSelect = document.getElementById('chapter-filter');
    chapSelect.innerHTML = '<option value="All">Select Chapter...</option>';
    let chaptersToAdd = [];
    if (catSelect === "All") Object.values(chapterMetadata).forEach(chaps => chaptersToAdd = chaptersToAdd.concat(chaps));
    else if (chapterMetadata[catSelect]) chaptersToAdd = chapterMetadata[catSelect];

    [...new Set(chaptersToAdd)].sort().forEach(chap => chapSelect.innerHTML += `<option value="${chap}">${chap}</option>`);
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
    if (success) startQuizEngine(300); 
}

async function startCustomPractice() {
    let exam = document.getElementById('exam-filter').value;
    let part = document.getElementById('part-filter').value;
    let category = document.getElementById('category-filter').value;
    let chapter = document.getElementById('chapter-filter').value;
    let numQuestions = document.getElementById('num-questions').value;
    let timeLimitMins = document.getElementById('time-limit').value;

    let queryUrl = `${API_URL}?mode=custom&exam=${encodeURIComponent(exam)}&part=${encodeURIComponent(part)}&category=${encodeURIComponent(category)}&chapter=${encodeURIComponent(chapter)}&limit=${numQuestions}`;
    let success = await fetchQuizData(queryUrl);
    if (success) startQuizEngine(timeLimitMins * 60); 
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
    
    let qHTML = `<h3 style="margin-top: 0;">Q${currentQuestionIndex + 1}: ${parseContent(getCol(qData, 'Question Text'), '100%')}</h3>`;
    let extImage = getCol(qData, 'Image URL');
    if (extImage !== '') qHTML += `<img src="${extImage}" style="max-width: 100%; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #e2e8f0;">`;
    qHTML += `<div style="display: inline-block; background: #f1f5f9; color: #64748b; font-size: 0.85rem; padding: 0.25rem 0.75rem; border-radius: 12px; margin-bottom: 1.5rem; font-weight: bold;">⭐ Difficulty Rating: ${qRating}</div>`;
    
    document.getElementById('question-text').innerHTML = qHTML;
    
    let container = document.getElementById('options-container');
    let optionsHTML = '';
    
    // MSQ Alert Label
    if (qType === 'MSQ') optionsHTML += `<p style="color: #0ea5e9; font-weight: bold; font-size: 0.9rem; margin-top: -1rem; margin-bottom: 1rem;">[Multiple Select Question: Choose all that apply]</p>`;
    
    if (qType === 'FITB') {
        let currentAns = userAnswers[currentQuestionIndex] || '';
        optionsHTML = `<input type="text" class="fitb-input" placeholder="Type answer..." value="${currentAns}" onkeyup="selectFITB(this.value)">`;
    } else if (qType === 'MSQ') {
        let currentSelections = Array.isArray(userAnswers[currentQuestionIndex]) ? userAnswers[currentQuestionIndex] : [];
        ['A', 'B', 'C', 'D'].forEach(opt => {
            let optText = getCol(qData, `Option ${opt}`);
            if (optText) {
                let isSel = currentSelections.includes(opt) ? 'selected' : '';
                optionsHTML += `<button class="option-btn ${isSel}" onclick="selectMSQOption('${opt}')"><b>${opt}.</b> ${parseContent(optText, '250px')}</button>`;
            }
        });
    } else { // Standard MCQ
        ['A', 'B', 'C', 'D'].forEach(opt => {
            let optText = getCol(qData, `Option ${opt}`);
            if (optText) {
                let isSel = userAnswers[currentQuestionIndex] === opt ? 'selected' : '';
                optionsHTML += `<button class="option-btn ${isSel}" onclick="selectOption('${opt}')"><b>${opt}.</b> ${parseContent(optText, '250px')}</button>`;
            }
        });
    }
    container.innerHTML = optionsHTML;

    document.getElementById('prev-btn').style.visibility = (currentQuestionIndex === 0) ? 'hidden' : 'visible';
    document.getElementById('next-btn').style.visibility = (currentQuestionIndex === currentQuizData.length - 1) ? 'hidden' : 'visible';
}

function selectOption(t) { userAnswers[currentQuestionIndex] = t; renderQuestion(); }
function selectFITB(t) { userAnswers[currentQuestionIndex] = t; }

// NEW: Toggle Logic for Multiple Select
function selectMSQOption(t) {
    if (!Array.isArray(userAnswers[currentQuestionIndex])) userAnswers[currentQuestionIndex] = [];
    let idx = userAnswers[currentQuestionIndex].indexOf(t);
    if (idx > -1) userAnswers[currentQuestionIndex].splice(idx, 1); // Deselect
    else userAnswers[currentQuestionIndex].push(t); // Select
    renderQuestion();
}

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

// --- PRE-SUBMIT REVIEW UI ---
function buildPreSubmitReview() {
    let listHTML = '';
    currentQuizData.forEach((qData, index) => {
        let userAns = userAnswers[index];
        let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
        
        let qTextDisplay = parseContent(getCol(qData, 'Question Text'), '100%');
        let extImage = getCol(qData, 'Image URL');
        if (extImage !== '') qTextDisplay += `<br><img src="${extImage}" style="max-width: 100%; border-radius: 8px; margin-top: 0.5rem; display: block; border: 1px solid #e2e8f0;">`;

        let optionsHTML = '';
        if (qType === 'FITB') {
            let displayAns = userAns ? `<span style="color: #0ea5e9; font-weight: bold;">${userAns}</span>` : `<span style="color: #ef4444; font-weight: bold;">Unanswered</span>`;
            optionsHTML = `<p style="margin: 0.5rem 0 0 0; font-size: 0.95rem;">Your Answer: ${displayAns}</p>`;
        } else {
            let userArr = (qType === 'MSQ' && Array.isArray(userAns)) ? userAns : [userAns];
            let hasAnswered = (qType === 'MSQ' && userArr.length > 0) || (qType !== 'MSQ' && userAns);

            ['A', 'B', 'C', 'D'].forEach(opt => {
                let optText = getCol(qData, `Option ${opt}`);
                if (optText) {
                    let isSel = userArr.includes(opt);
                    let bgStyle = isSel ? 'background: #e0f2fe; border: 1px solid #0ea5e9; color: #0284c7;' : 'background: transparent; border: 1px solid #e2e8f0; color: #64748b;';
                    let weight = isSel ? 'font-weight: bold;' : '';
                    optionsHTML += `<div style="${bgStyle} ${weight} padding: 0.5rem 0.8rem; margin-top: 0.4rem; border-radius: 6px; font-size: 0.9rem;">${opt}. ${parseContent(optText, '150px')}</div>`;
                }
            });
            if (!hasAnswered) optionsHTML += `<p style="color: #ef4444; font-weight: bold; font-size: 0.9rem; margin-top: 0.5rem;">Unanswered</p>`;
        }
        
        listHTML += `
            <div style="background: #ffffff; padding: 1.5rem; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 1rem; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <button onclick="jumpToQuestion(${index})" style="position: absolute; top: 1.5rem; right: 1.5rem; background: #e2e8f0; color: #0f172a; font-weight: 600; font-size: 0.85rem; padding: 0.4rem 0.8rem; border-radius: 6px; border: none; cursor: pointer;">Change</button>
                <div style="padding-right: 5rem;">
                    <p style="margin: 0 0 1rem 0; font-size: 1rem; color: #0f172a;"><b>Q${index + 1}:</b> ${qTextDisplay}</p>
                    ${optionsHTML}
                </div>
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
        let userAns = userAnswers[index];
        let rawCorrect = String(getCol(qData, 'Correct Answer')).trim();
        let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
        let qID = getCol(qData, 'Question ID') || `Unknown-Q${index}`; 
        
        let isCorrect = false;
        let correctArr = [];
        let userArr = [];

        // 1. Scoring Logic
        if (qType === 'MSQ') {
            // Split "A;B;C" into an array, clean spaces, and sort alphabetically
            correctArr = rawCorrect.split(';').map(s => s.trim().toUpperCase()).sort();
            userArr = Array.isArray(userAns) ? userAns.slice().sort() : [];
            // Arrays must match in length and content
            isCorrect = (correctArr.length === userArr.length && correctArr.every((val, i) => val === userArr[i]));
        } else if (qType === 'FITB') {
            userAns = userAns || "Unanswered";
            if (userAns.toString().trim().toLowerCase() === rawCorrect.toLowerCase()) isCorrect = true;
        } else {
            // Standard MCQ
            userAns = userAns || "Unanswered";
            let correctLetter = /^[A-D]$/i.test(rawCorrect) ? rawCorrect.toUpperCase() : "None";
            if (correctLetter === "None") {
                ['A', 'B', 'C', 'D'].forEach(opt => {
                    if (String(getCol(qData, `Option ${opt}`)).trim().toLowerCase() === rawCorrect.toLowerCase()) correctLetter = opt;
                });
            }
            correctArr = [correctLetter];
            userArr = [userAns];
            if (userAns === correctLetter) isCorrect = true;
        }

        if (isCorrect) score++;

        let statusText = isCorrect 
            ? `<p class="result-status status-correct" style="margin-bottom: 0.5rem;">✓ Correct</p>`
            : `<p class="result-status status-incorrect" style="margin-bottom: 0.5rem;">✗ Incorrect</p>`;

        // 2. Render Options Visuals
        let optionsReviewHTML = '';
        if (qType !== 'FITB') {
            ['A', 'B', 'C', 'D'].forEach(opt => {
                let optText = getCol(qData, `Option ${opt}`);
                if (optText) {
                    let isUserChoice = userArr.includes(opt);
                    let isActualCorrect = correctArr.includes(opt);
                    
                    let bgStyle = isActualCorrect ? 'background: #dcfce7; border: 1px solid #22c55e; color: #15803d; font-weight: bold;' 
                                : (isUserChoice && !isActualCorrect) ? 'background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c;' 
                                : 'background: transparent; border: 1px solid #e2e8f0; color: #0f172a;';
                    let icon = isActualCorrect ? ' ✓' : (isUserChoice ? ' (Your Answer)' : '');

                    optionsReviewHTML += `<div style="${bgStyle} padding: 0.5rem; margin-top: 0.25rem; border-radius: 6px; font-size: 0.95rem;">${opt}. ${parseContent(optText, '150px')} ${icon}</div>`;
                }
            });
        } else {
            optionsReviewHTML = `<div style="background: #f8fafc; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem;"><p style="margin: 0; color: #64748b;">Your Answer: <b>${userAns}</b></p><p style="margin: 0.25rem 0 0 0; color: #15803d;">Correct Answer: <b>${rawCorrect}</b></p></div>`;
        }

        let rawExplanation = getCol(qData, 'Explanation');
        let explanationBlock = rawExplanation !== '' 
            ? `<div class="explanation-box" style="margin-top: 1rem; background: #e0f2fe; padding: 1rem; border-radius: 8px; font-size: 0.95rem; border: 1px solid #bae6fd;"><b>Explanation:</b><br>${parseContent(rawExplanation, '100%')}</div>` : '';

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

        let qTextDisplay = parseContent(getCol(qData, 'Question Text'), '100%');
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
