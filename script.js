const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1onVR2v7-_WzvPypCS8r8NX8wMphymSpb?usp=drive_link";
const DRIVE_INDEX_PATH = "data/drive-index.json";

const fallbackTree = {
  title: "全部资料",
  type: "folder",
  url: DRIVE_FOLDER_URL,
  updatedAt: "",
  children: []
};

let rootTree = fallbackTree;
let currentFolder = fallbackTree;
let currentPath = [fallbackTree];
let activeSearch = "";
let nodeMap = new Map();

const searchInput = document.getElementById("searchInput");
const backBtn = document.getElementById("backBtn");
const breadcrumb = document.getElementById("breadcrumb");
const folderTree = document.getElementById("folderTree");
const contentList = document.getElementById("contentList");
const viewTitle = document.getElementById("viewTitle");
const resultCount = document.getElementById("resultCount");
const openAllBtn = document.getElementById("openAllBtn");
const themeToggle = document.getElementById("themeToggle");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarPanel = document.getElementById("sidebarPanel");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

const THEME_KEY = "vita-site-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = themeToggle?.querySelector(".theme-icon");
  if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
  if (themeToggle) {
    themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "切换为浅色模式" : "切换为深色模式"
    );
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(stored || (prefersDark ? "dark" : "light"));
}

themeToggle?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

function openSidebar() {
  sidebarPanel?.classList.add("open");
  sidebarBackdrop?.classList.add("open");
  sidebarToggle?.setAttribute("aria-expanded", "true");
}
function closeSidebar() {
  sidebarPanel?.classList.remove("open");
  sidebarBackdrop?.classList.remove("open");
  sidebarToggle?.setAttribute("aria-expanded", "false");
}
sidebarToggle?.addEventListener("click", () => {
  if (sidebarPanel?.classList.contains("open")) closeSidebar();
  else openSidebar();
});
sidebarBackdrop?.addEventListener("click", closeSidebar);

initTheme();

function safeNode(node) {
  const title = node?.title || "未命名";
  const type = node?.type === "file" ? "file" : "folder";
  const children = type === "folder" ? (Array.isArray(node?.children) ? node.children : []) : undefined;
  return { title, type, url: node?.url || DRIVE_FOLDER_URL, updatedAt: node?.updatedAt || "-", children };
}

function normalizeTree(node) {
  const normalized = safeNode(node);
  if (normalized.type === "file") return normalized;

  normalized.children = (normalized.children || [])
    .map((child) => normalizeTree(child))
    .filter(Boolean);
  return normalized;
}

function buildVisibleRoot(rawRoot) {
  const normalizedRoot = normalizeTree(rawRoot);
  if (!normalizedRoot) return safeNode(fallbackTree);
  return {
    title: "全部资料",
    type: "folder",
    url: normalizedRoot.url || DRIVE_FOLDER_URL,
    updatedAt: normalizedRoot.updatedAt || "",
    children: normalizedRoot.children || []
  };
}

function buildRuntimeTree(node, parent = null, parentPath = [], parentPathKey = "") {
  const currentPath = [...parentPath, node.title];
  const currentPathKey = parent ? `${parentPathKey}/${node.title}` : "";

  node.parent = parent;
  node.path = currentPath;
  node.pathKey = currentPathKey;
  node.depth = parent ? parent.depth + 1 : 0;

  nodeMap.set(node.pathKey, node);

  if (node.type === "folder") {
    node.children = (node.children || []).map((child) => buildRuntimeTree(child, node, currentPath, currentPathKey));
  }

  return node;
}

function buildPathFromNode(node) {
  const path = [];
  let cursor = node;
  while (cursor) {
    path.unshift(cursor);
    cursor = cursor.parent || null;
  }
  return path;
}

function listFolders(node, acc = []) {
  acc.push(node);
  (node.children || []).forEach((child) => {
    if (child.type === "folder") listFolders(child, acc);
  });
  return acc;
}

function setCurrentFolderByPathKey(pathKey) {
  const target = nodeMap.get(pathKey);
  if (!target || target.type !== "folder") return;
  currentFolder = target;
  currentPath = buildPathFromNode(target);
  render();
  closeSidebar();
}

function renderFolderTree() {
  folderTree.innerHTML = "";
  const folders = listFolders(rootTree);
  folders.forEach((node) => {
    const item = document.createElement("div");
    item.className = "tree-item";
    item.style.paddingLeft = `${node.depth * 14 + 6}px`;
    item.textContent = `📁 ${node.title}`;
    if (node.pathKey === currentFolder.pathKey) item.classList.add("active");
    item.addEventListener("click", () => setCurrentFolderByPathKey(node.pathKey));
    folderTree.appendChild(item);
  });
}

function renderBreadcrumb() {
  breadcrumb.innerHTML = "";
  currentPath.forEach((node, idx) => {
    if (idx > 0) breadcrumb.append(" / ");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = idx === 0 ? "全部资料" : node.title;
    button.addEventListener("click", () => setCurrentFolderByPathKey(node.pathKey));
    breadcrumb.appendChild(button);
  });
}

function sortChildren(children) {
  return [...children].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });
}

function renderFolderView() {
  viewTitle.textContent = currentFolder === rootTree ? "全部资料" : currentFolder.title;
  console.log("Current folder selected:", {
    title: currentFolder.title,
    pathKey: currentFolder.pathKey,
    childrenCount: currentFolder.children?.length,
    children: currentFolder.children
  });

  const folderChildren = currentFolder.children || [];
  resultCount.textContent = `共 ${folderChildren.length} 项`;

  contentList.innerHTML = "";
  if (folderChildren.length === 0) {
    const emptyMessage =
      currentFolder === rootTree
        ? "目录尚未同步。请先运行 GitHub Actions 更新 Google Drive 目录。"
        : "该文件夹为空。";
    contentList.innerHTML = `<div class="empty-message muted">${emptyMessage}</div>`;
    return;
  }

  const children = sortChildren(folderChildren);
  children.forEach((item) => {
    const action = document.createElement("a");
    action.className = "btn ghost";
    action.href = item.url || DRIVE_FOLDER_URL;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = "打开";

    const metaText = formatMeta(item);
    contentList.appendChild(createCard(item, metaText, action));
  });
}


function formatMeta(item, fallbackPath = "") {
  const typeLabel = item.type === "folder" ? "文件夹" : "PDF";
  const timeLabel = item.updatedAt || fallbackPath || "-";
  return `${typeLabel} · ${timeLabel}`;
}

function createCard(item, metaText, actionNode) {
  const card = document.createElement("div");
  card.className = "file-card";

  const main = document.createElement("div");
  main.className = "file-main";

  const title = document.createElement(item.type === "folder" ? "button" : "div");
  title.className = item.type === "folder" ? "file-title name-btn" : "file-title";
  title.textContent = `${item.type === "folder" ? "📁" : "📄"} ${item.title}`;
  if (item.type === "folder") {
    title.type = "button";
    title.addEventListener("click", () => setCurrentFolderByPathKey(item.pathKey));
  }

  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.textContent = metaText;

  main.append(title, meta);
  card.append(main, actionNode);
  return card;
}

function searchTree(keyword) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return [];

  const results = [];
  function walk(node) {
    const isMatch = node.title.toLowerCase().includes(normalized) && (node.type === "folder" || node.type === "file");
    if (isMatch) {
      results.push({ node, path: buildPathFromNode(node) });
    }
    (node.children || []).forEach((child) => walk(child));
  }
  walk(rootTree);
  return results.filter((item) => item.node !== rootTree);
}

function renderSearchResults() {
  const results = searchTree(activeSearch);
  viewTitle.textContent = `搜索：${activeSearch}`;
  resultCount.textContent = `共 ${results.length} 项`;
  contentList.innerHTML = "";

  if (results.length === 0) {
    contentList.innerHTML = '<div class="empty-message muted">没有匹配结果。</div>';
    return;
  }

  results.forEach(({ node, path }) => {
    const action = document.createElement(node.type === "folder" ? "button" : "a");
    action.className = "btn ghost";
    if (node.type === "folder") {
      action.type = "button";
      action.textContent = "进入";
      action.addEventListener("click", () => {
        activeSearch = "";
        searchInput.value = "";
        setCurrentFolderByPathKey(node.pathKey);
      });
    } else {
      action.href = node.url || DRIVE_FOLDER_URL;
      action.target = "_blank";
      action.rel = "noopener noreferrer";
      action.textContent = "打开";
    }

    const folderPath = path.slice(1, -1).map((item) => item.title).join(" / ") || "全部资料";
    const metaText = node.type === "folder" ? `文件夹 · ${folderPath}` : formatMeta(node, folderPath);
    contentList.appendChild(createCard(node, metaText, action));
  });
}

function render() {
  backBtn.disabled = currentPath.length <= 1;
  renderFolderTree();
  renderBreadcrumb();
  if (activeSearch.trim()) {
    renderSearchResults();
  } else {
    renderFolderView();
  }
}

async function loadTree() {
  try {
    const res = await fetch(DRIVE_INDEX_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    rootTree = buildVisibleRoot(data);
  } catch (error) {
    console.warn("读取 drive-index.json 失败，使用 fallbackTree", error);
    rootTree = safeNode(fallbackTree);
  }

  nodeMap = new Map();
  rootTree = buildRuntimeTree(rootTree);

  openAllBtn.href = rootTree.url || DRIVE_FOLDER_URL;
  currentFolder = rootTree;
  currentPath = [rootTree];
  render();
}

searchInput.addEventListener("input", (event) => {
  activeSearch = event.target.value.trim();
  render();
});

backBtn.addEventListener("click", () => {
  if (!currentFolder.parent) return;
  setCurrentFolderByPathKey(currentFolder.parent.pathKey);
});

loadTree();
