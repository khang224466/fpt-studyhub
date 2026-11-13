// Embedded in the bookmarklet by build-edunext.cjs. No provider secrets live here.
function readEduNextTurn(doc) {
  const messageSelector = '.wrap-message-view, [class*="message-item"], [class*="chat-item"], .chat-message, .w-chat-item';
  const questionSelector = '.exercise-question-block, [class*="exercise-question"], [class*="question-content"], .question-title, [class*="question-box"]';
  const text = element => (element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
  const visible = element => !element.closest('#enx-pro-hud') && element.getClientRects().length > 0;
  const after = (element, anchor) => !anchor || (!element.contains(anchor) && Boolean(anchor.compareDocumentPosition(element) & 4));
  const all = selector => Array.from(doc.querySelectorAll(selector)).filter(visible);
  const students = all('span, p, small, label, div').filter(element => /^(học sinh|sinh viên|student)$/i.test(text(element)) && !Array.from(element.children).some(child => /^(học sinh|sinh viên|student)$/i.test(text(child))));
  const studentBadge = students.at(-1) || null;
  const studentMessage = studentBadge?.closest(messageSelector) || studentBadge;
  const messages = all(messageSelector).filter(element => !Array.from(element.querySelectorAll(messageSelector)).some(visible));
  const teacher = messages.filter(element => after(element, studentMessage) && !element.contains(studentBadge) && !element.matches('.student, .user, [data-role="student"], [data-role="user"]')).at(-1);
  // A new question can appear before EduNext appends its feedback toolbar.
  const question = all(questionSelector).filter(element => after(element, studentMessage)).at(-1);
  const content = question || teacher;
  const lastTeacherMsg = text(teacher || question);
  const questionBlockText = text(question || teacher);
  const imageIds = content ? Array.from(content.querySelectorAll('img')).map(image => image.currentSrc || image.src).join('|') : '';
  const fingerprint = [doc.location?.href || '', studentMessage?.id || '', text(studentMessage), content?.id || '', questionBlockText, lastTeacherMsg, imageIds].join('\n');
  return {
    state: content && (questionBlockText || imageIds) ? 'student_turn' : studentMessage ? 'waiting_teacher' : 'idle',
    lastStudentBadge: studentBadge, lastTeacherBadge: teacher || null,
    lastStudentMsg: text(studentMessage), lastTeacherMsg, questionBlockText,
    fingerprint, imageIds
  };
}
