
const convertFlatToNested = (data) => {
    return data.reduce((acc, item) => {
        const parts = item.path.split('/');
        let currentLevel = acc;

        parts.forEach((part, i) => {
            let existingPath = currentLevel.find(node => node.text === part);

            if (!existingPath) {
                existingPath = {
                    id: `${item.sha}`,
                    text: part,
                    status: 0,
                    state: {
                        open: false,
                        expanded: false
                    },
                    path: item.path,
                    sha: item.sha
                };
                if (i < parts.length - 1 || item.type === 'tree') {
                    existingPath.children = [];
                }
                currentLevel.push(existingPath);
            }
            if (!existingPath.children)
                return
            currentLevel = existingPath.children;
        });

        return sortNodes(acc);
    }, []);
};


const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
        const aHasChildren = Array.isArray(a.children);
        const bHasChildren = Array.isArray(b.children);

        // 1. Sort by "Folder-ness" (true/false)
        if (aHasChildren && !bHasChildren) return -1;
        if (!aHasChildren && bHasChildren) return 1;

        // 2. Then sort alphabetically by text
        return a.text.localeCompare(b.text);
    });

    // 3. Recurse into children
    nodes.forEach(node => {
        if (node.children) sortNodes(node.children);
    });

    return nodes;
};
