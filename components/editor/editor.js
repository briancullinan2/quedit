
let tempCount = 1;



const sessionCache = {};

updateMaxLines();





aceEditor.commands.addCommand({
	name: "save",
	bindKey: { win: "Ctrl-S", mac: "Command-S" },
	exec: function (editor)
	{
		saveFile();
	}
});


let currentFileShaDebouncer = null;
function debounceFileChange(editor, delay = 1000)
{
	if(currentFileShaDebouncer)
	{
		return;
	}

	currentFileShaDebouncer = setTimeout(async () =>
	{
		if(!aceEditor) return;

		try
		{
			const currentContent = aceEditor.getValue();
			// Calculate the SHA asynchronously in the background
			window.currentOpenFileId = await window.getGitShaBrowser(currentContent);
			currentFileShaDebouncer = null;
		} catch(err)
		{
			console.error("Failed to compute file SHA during debounce:", err);
		}
	}, delay);
}


async function saveFile()
{
	const database = owner.value + '/' + repository.value;
	const filePath = currentSession();
	if(!filePath)
		filePath = trees[database].nodesById[window.currentOpenFileId].path;
	const content = aceEditor.getValue();
	const newSha = await getGitShaBrowser(content);
	FS.virtual[filePath] = {
		timestamp: new Date(),
		mode: FS_FILE,
		contents: new TextEncoder().encode(content),
		path: filePath,
		sha: newSha,
		parent: filePath.substring(0, filePath.lastIndexOf('/'))
	};
	window.currentOpenFileId = newSha;
	if(files[database])
	{
		await putRecord(DB_STORE_NAME, FS.virtual[filePath], database);
		if(files[database][filePath])
			files[database][filePath].sha = newSha;
		else
			files[database][filePath] = FS.virtual[filePath];
		trees[database].nodesById[newSha] = files[database][filePath];
	}

	if(filePath.includes('settings') && filePath.endsWith('.json'))
		saveSettings(content);
}



