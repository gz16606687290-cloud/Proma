---
name: git-fork-workflow
description: Git Fork + Upstream workflow management. Use when the user wants to: (1) set up a Fork + Upstream remote configuration so they can commit to their own repo while syncing updates from the original author, (2) sync/pull the latest changes from the upstream (original) repository, (3) push their own changes to their forked repository, (4) resolve merge conflicts between their fork and upstream, or (5) fix VS Code "Sync Changes" pointing to the wrong remote.
---

# Git Fork 工作流

此 Skill 用于管理 Fork + Upstream 双远程工作流，适用于克隆了别人的项目、想在自己的仓库提交代码并随时同步原作者更新的场景。

## 核心概念

- **`origin`**：指向用户自己的 Fork 仓库，拥有读写权限，所有修改提交到此处
- **`upstream`**：指向原作者的仓库，只读，用于拉取原作者的最新代码

## 工作流一：初始配置（首次设置）

当用户已克隆原作者项目但尚未配置双远程时执行：

```bash
# 1. 将当前 origin（原作者）重命名为 upstream
git remote rename origin upstream

# 2. 添加用户自己的 Fork 仓库为 origin
git remote add origin <用户的Fork仓库地址>

# 3. 将本地 main 分支跟踪目标设为 origin/main（避免 VS Code Sync 推送到 upstream）
git branch --set-upstream-to=origin/main main

# 4. 验证配置
git remote -v
git branch -vv
```

**预期结果：**
- `origin` → 用户的 Fork 地址 (fetch & push)
- `upstream` → 原作者地址 (fetch & push)
- `main` tracking `origin/main`

## 工作流二：同步原作者最新代码

```bash
# 1. 拉取原作者的所有更新
git fetch upstream

# 2. 将原作者的修改合并到本地（若有未提交改动先用 stash 暂存）
git stash           # 如有未提交的本地修改
git merge upstream/main
git stash pop       # 恢复本地修改（如有 stash）

# 3. 同步到用户自己的 GitHub 仓库
git push origin main
```

## 工作流三：提交用户自己的修改

```bash
git add .
git commit -m "描述修改内容"
git push origin main
```

## 处理合并冲突

若 `git merge upstream/main` 出现 CONFLICT：

1. 查看冲突文件：`git status`
2. 对于 lockfile（如 `bun.lock`、`package-lock.json`）：优先使用 upstream 版本
   ```bash
   git checkout --theirs bun.lock
   ```
3. 对于业务代码（如 `.tsx`、`.ts`）：根据实际改动判断保留哪一方，或手动合并
4. 解决后标记为已解决并提交：
   ```bash
   git add <已解决的文件>
   git commit -m "Merge upstream/main: resolve conflicts"
   git push origin main
   ```

## VS Code "同步更改" 指向错误远程的修复

当 VS Code 点击"同步更改"弹出提示说会推送到 `upstream/main` 时，执行：

```bash
git branch --set-upstream-to=origin/main main
```

## 常用检查命令

```bash
git remote -v          # 查看远程配置
git branch -vv         # 查看分支及其跟踪关系
git status             # 查看当前工作区状态
git log --oneline -5   # 查看最近提交历史
```
