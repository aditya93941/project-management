const fs = require('fs');
const path = require('path');

const targetFile = path.join('c:/Users/AUSU/OneDrive/Desktop/task manager/task-management/frontend/src/pages', 'EODReports.jsx');

console.log('Reading file:', targetFile);
let content = fs.readFileSync(targetFile, 'utf8');

// 1. LOCATE "In Progress Results" Section to Replace
// We look for: {/* In Progress Tasks */}
const inProgressStart = content.indexOf('{/* In Progress Tasks */}');
const blockersStart = content.indexOf('{/* Blockers */}');

if (inProgressStart === -1 || blockersStart === -1) {
    console.error('Could not find In Progress or Blockers markers');
    process.exit(1);
}

console.log('Found In Progress section at:', inProgressStart);
console.log('Found Blockers section at:', blockersStart);

// New In Progress + Right Column + Status Card + Start of Blockers Card
const newInProgressSection = `          {/* In Progress Tasks Card */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800/50">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Clock className="w-5 h-5 text-blue-500" />
                   </div>
                   <div>
                      <h2 className="font-semibold text-zinc-100">In Progress</h2>
                      <p className="text-xs text-zinc-500">Tasks continuing tomorrow</p>
                   </div>
                </div>
                <div className="bg-zinc-800 px-3 py-1 rounded-full text-xs text-zinc-400">
                   {formData.inProgressTasks.length} tasks
                </div>
             </div>

             <div className="space-y-4">
                {formData.inProgressTasks.map((item, idx) => {
                   const task = findTaskById(item.taskId)
                   if (!task) return null
                   return (
                      <div key={idx} className="p-4 bg-black/40 rounded-lg border border-zinc-800">
                         <div className="flex items-center justify-between mb-3">
                            <div>
                               <Link href={\`/tasks?taskId=\${item.taskId}\`} className="text-sm font-medium text-zinc-200 hover:text-white transition-colors">
                                  {task.title}
                               </Link>
                               <div className="flex items-center gap-2 mt-1">
                                   <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium">{task.type}</span>
                                   <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium">{task.priority}</span>
                               </div>
                            </div>
                            {isEditable && (
                               <button onClick={() => handleTaskToggle(item.taskId, 'inProgress')} className="text-zinc-500 hover:text-red-400 p-1">
                                  <X className="w-4 h-4" />
                               </button>
                            )}
                         </div>
                         {isEditable && (
                            <div className="flex items-center gap-3">
                               <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: \`\${item.progress || 0}%\` }} />
                               </div>
                               <input 
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={item.progress || 0}
                                  onChange={(e) => handleProgressChange(item.taskId, e.target.value)}
                                  className="w-12 bg-zinc-800 border-none rounded text-xs text-center text-zinc-300 focus:ring-1 focus:ring-blue-500"
                               />
                               <span className="text-xs text-zinc-500">%</span>
                            </div>
                         )}
                      </div>
                   )
                })}
                
                {formData.inProgressTasks.length === 0 && (
                   <p className="text-sm text-zinc-500 italic text-center py-4">
                      No tasks in progress.
                   </p>
                )}

                {isEditable && (
                    <div className="relative mt-2">
                      <button
                         onClick={() => setShowTaskSelector(prev => ({ ...prev, inProgress: !prev.inProgress }))}
                         className="w-full py-3 border border-dashed border-zinc-800 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all flex items-center justify-center gap-2"
                      >
                         <span className="text-xl leading-none">+</span> Add Task
                      </button>

                      {showTaskSelector.inProgress && (
                         <div className="absolute top-full left-0 right-0 mt-2 z-10 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 max-h-80 overflow-y-auto task-selector-container">
                            <div className="relative mb-3">
                               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                               <input
                                  type="text"
                                  placeholder="Search tasks..."
                                  value={taskSearchQuery.inProgress}
                                  onChange={(e) => setTaskSearchQuery(prev => ({ ...prev, inProgress: e.target.value }))}
                                  className="w-full pl-10 pr-4 py-2 rounded bg-black/50 border border-zinc-700 text-zinc-200 text-sm focus:border-zinc-500 focus:ring-0"
                                  autoFocus
                               />
                            </div>
                            <div className="space-y-1">
                               {getFilteredTasks(getAllAvailableTasks().filter(t => !formData.inProgressTasks.some(ip => ip.taskId === (t.id || t._id))), 'inProgress').map((task) => {
                                  const taskId = task.id || task._id
                                  return (
                                    <button
                                       key={taskId}
                                       onClick={() => {
                                          handleTaskToggle(taskId, 'inProgress')
                                          setShowTaskSelector(prev => ({ ...prev, inProgress: false }))
                                          setTaskSearchQuery(prev => ({ ...prev, inProgress: '' }))
                                       }}
                                       className="w-full text-left p-3 rounded hover:bg-zinc-800 transition-colors"
                                    >
                                       <p className="text-sm font-medium text-zinc-200">{task.title}</p>
                                       <p className="text-xs text-zinc-500 mt-0.5">{task.type} • {task.priority}</p>
                                    </button>
                                  )
                               })}
                               {getFilteredTasks(getAllAvailableTasks(), 'inProgress').length === 0 && (
                                  <p className="text-xs text-zinc-500 text-center py-2">No tasks found</p>
                               )}
                            </div>
                         </div>
                      )}
                    </div>
                )}
             </div>
          </div>
        </div>

        {/* Right Column: Extras & Actions */}
        <div className="space-y-6">
           
           {/* Status Card */}
           <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800/50">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Report Status</h3>
              <div className="flex items-center justify-between mb-4">
                 <span className={\`px-3 py-1 rounded-full text-xs font-medium \${
                    isSubmitted ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-400'
                 }\`}>
                    {isSubmitted ? (todayEOD?.isFinal ? 'Submitted & Final' : 'Submitted (Editable)') : 'Draft'}
                 </span>
                 {timeUntilEndOfDay && !todayEOD?.isFinal && (
                    <span className="text-xs text-zinc-500">
                       Closing in {timeUntilEndOfDay.hours}h {timeUntilEndOfDay.minutes}m
                    </span>
                 )}
              </div>
              
              {/* Auto-save Indicator */}
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
                 {saveStatus === 'saving' ? (
                    <>
                       <RefreshCw className="w-3 h-3 animate-spin" /> Saving changes...
                    </>
                 ) : saveStatus === 'saved' ? (
                    <>
                       <CheckCircle className="w-3 h-3 text-green-500" /> All changes saved
                    </>
                 ) : saveStatus === 'error' ? (
                    <>
                       <AlertCircle className="w-3 h-3 text-red-500" /> Save failed
                    </>
                 ) : (
                    <>
                       <CheckCircle className="w-3 h-3" /> Ready to submit
                    </>
                 )}
              </div>

              {/* Submit Button */}
              {isEditable && (
                 <div className="space-y-3">
                    <div className="flex gap-1 relative">
                       <button
                          onClick={() => handleSubmit(true)}
                          disabled={isSubmitting || (formData.completedTasks.length === 0 && formData.inProgressTasks.length === 0)}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-l-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                       >
                          {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Send className="w-4 h-4" />}
                          Submit Report
                       </button>
                       <button 
                          onClick={() => setShowSubmitDropdown(!showSubmitDropdown)}
                          disabled={isSubmitting}
                          className="bg-blue-700 hover:bg-blue-600 text-white px-3 rounded-r-lg border-l border-blue-800 transition-colors"
                       >
                          <ChevronDown className="w-4 h-4" />
                       </button>
                       
                       {showSubmitDropdown && (
                          <div className="absolute top-full right-0 mt-1 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 overflow-hidden">
                             <button
                                onClick={() => { setShowScheduleModal(true); setShowSubmitDropdown(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-700 transition-colors text-zinc-200"
                             >
                                <Calendar className="w-4 h-4 text-zinc-400" />
                                <div>
                                   <div className="text-sm font-medium">Schedule Submit</div>
                                   <div className="text-[10px] text-zinc-500">Pick a time later today</div>
                                </div>
                             </button>
                          </div>
                      )}
                    </div>
                 </div>
              )}
           </div>

           {/* Notes & Blockers Card */}
           <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800/50 space-y-8">
\n\n`;

// 2. LOCATE Actions to Close Card
const actionsStart = content.indexOf('{/* Actions */}');
if (actionsStart === -1) {
    console.error('Could not find Actions marker');
    process.exit(1);
}

// 3. Perform Replacement 1: In Progress -> New
// Replacing from beginning of In Progress comment until beginning of Blockers comment
let updatedContent = content.substring(0, inProgressStart) + newInProgressSection + content.substring(blockersStart);

// 4. Perform Replacement 2: Close Blockers Card before Actions
// We need to find where Actions start in the UPDATED content. 
// Since we inserted text, the offset shifted. We search again.
const newActionsStart = updatedContent.indexOf('{/* Actions */}');

// We want to insert closing divs before Actions.
const closingDivs = `
           </div>
        </div>
      </div>
`;
// Replace Actions section entirely?
// The Actions section contains buttons we moved to Right Column Status Card.
// So we should REMOVE the Actions section entirely, or empty it out?
// The Auto-save logic was also duplicated in Status Card.
// So we can remove the footer actions.
// BUT we still need the "Schedule Submit Modal" which is at the end of Actions block.

// Let's find end of Actions block or start of Modals.
const scheduleModalStart = updatedContent.indexOf('{/* Schedule Submit Modal */}');
if (scheduleModalStart === -1) {
    // Maybe it's named differently or I need to check.
    // Looking at file content: { showScheduleModal && ( ...
    // around line 1801.
    // Comment is: {/* Schedule Submit Modal */}
}

// Delete from Actions Start to Schedule Modal Start, and insert Closing Divs.
updatedContent = updatedContent.substring(0, newActionsStart) + closingDivs + updatedContent.substring(scheduleModalStart);

console.log('Replacing content...');
fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log('File updated successfully!');
