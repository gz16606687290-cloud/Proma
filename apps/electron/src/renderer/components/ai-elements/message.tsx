/**
 * AI Elements - 消息组件原语
 *
 * 简化迁移自 proma-frontend 的 ai-elements/message.tsx，
 * 保留核心消息展示组件，适配 Electron + Jotai 架构。
 *
 * 包含：
 * - Message — 根容器，`from` 属性区分 user/assistant
 * - MessageHeader — 头像 + 模型名
 * - MessageContent — 内容区域
 * - MessageActions — 操作按钮容器
 * - MessageAction — 单个操作按钮（可选 Tooltip）
 * - MessageResponse — react-markdown 渲染
 * - UserMessageContent — 长文本自动折叠
 * - MessageLoading — 3 个弹跳点加载动画
 * - MessageStopped — "已停止生成" 状态标记
 * - StreamingIndicator — 流式呼吸脉冲点
 */

import * as React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CodeBlock, MermaidBlock } from '@proma/ui'
import type { HTMLAttributes, ComponentProps, ReactNode } from 'react'
import type { FileAttachment } from '@proma/shared'

// ===== Message 根容器 =====

type MessageRole = 'user' | 'assistant' | 'system'

interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  /** 消息发送者角色 */
  from: MessageRole
}

/** 消息根容器，user 自动右对齐 */
export function Message({ className, from, ...props }: MessageProps): React.ReactElement {
  return (
    <div
      className={cn(
        'group flex w-full flex-col gap-0.5 rounded-[10px] px-2.5 py-2.5 transition-colors duration-300',
        from === 'user' ? 'is-user' : 'is-assistant',
        className
      )}
      {...props}
    />
  )
}

// ===== MessageHeader 头像 + 模型名 =====

interface MessageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** 模型名称 */
  model?: string
  /** 头像元素 */
  logo?: ReactNode
  /** 消息时间戳 */
  time?: string
}

/** 消息头部（user 时自动隐藏） */
export function MessageHeader({
  model,
  logo,
  time,
  className,
  children,
  ...props
}: MessageHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 mb-2.5',
        'group-[.is-user]:hidden',
        className
      )}
      {...props}
    >
      {logo && (
        <div className="flex size-[35px] shrink-0 items-center justify-center overflow-hidden rounded-[25%]">
          {logo}
        </div>
      )}
      <div className="flex flex-col justify-between h-[35px]">
        {model && <span className="text-sm font-semibold text-foreground/60 leading-none">{model}</span>}
        {time && <span className="text-[10px] text-foreground/[0.38] leading-none">{time}</span>}
      </div>
      {children}
    </div>
  )
}

// ===== MessageContent 内容区域 =====

type MessageContentProps = HTMLAttributes<HTMLDivElement>

/**
 * 消息内容区域
 * - user 消息：pl-[46px] 与头像对齐 + 浅色气泡背景
 * - assistant 消息：pl-[46px] 与头像对齐
 */
export function MessageContent({
  children,
  className,
  ...props
}: MessageContentProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex w-full max-w-full min-w-0 flex-col gap-2 overflow-hidden pl-[46px]',
        'group-[.is-user]:text-foreground',
        'group-[.is-assistant]:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ===== MessageActions 操作按钮容器 =====

type MessageActionsProps = ComponentProps<'div'>

/** 操作按钮容器（复制、删除等），默认隐藏，hover 显示 */
export function MessageActions({
  className,
  children,
  ...props
}: MessageActionsProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ===== MessageAction 单个操作按钮 =====

interface MessageActionProps extends ComponentProps<typeof Button> {
  /** 悬停提示文字 */
  tooltip?: string
  /** 无障碍标签 */
  label?: string
}

/** 单个操作按钮（含可选 Tooltip 包装） */
export function MessageAction({
  tooltip,
  children,
  label,
  variant = 'ghost',
  size = 'icon-sm',
  ...props
}: MessageActionProps): React.ReactElement {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}

// ===== MessageResponse Markdown 渲染 =====

/**
 * 移除已通过 ![alt](url) 内联展示的冗余链接列表项。
 * 例如：当消息中已有 ![猫](url1) 渲染图片时，
 * 后续的 "1. [图片1](url1)" 或 "1. **[图片1](url1)**" 列表项会被自动移除。
 * 同时清理孤立的引导文本（如"你可以通过以下链接查看："）。
 */
function removeRedundantImageLinks(content: string): string {
  // 收集所有 ![...](url) 中的图片 URL（原始 + 去掉查询参数的版本）
  const embeddedUrlsRaw = new Set<string>()
  const embeddedUrlsBase = new Set<string>()
  const imgPattern = /!\[[^\]]*\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = imgPattern.exec(content)) !== null) {
    const url = m[1]?.trim()
    if (url) {
      embeddedUrlsRaw.add(url)
      // 去掉查询参数和 hash，用于模糊匹配
      embeddedUrlsBase.add(url.split(/[?#]/)[0] ?? url)
    }
  }
  if (embeddedUrlsRaw.size === 0) return content

  /** 检查链接 URL 是否与已嵌入的图片 URL 匹配 */
  const isMatchedUrl = (linkUrl: string): boolean => {
    const trimmed = linkUrl.trim()
    if (embeddedUrlsRaw.has(trimmed)) return true
    return embeddedUrlsBase.has(trimmed.split(/[?#]/)[0] ?? trimmed)
  }

  // 逐行过滤：移除冗余链接列表项
  // 支持格式：1. [text](url) | 1. **[text](url)** | - [text](url) | 1. [**text**](url) 等
  let removedCount = 0
  const lines = content.split('\n')
  const filtered = lines.filter((line) => {
    // 保留图片嵌入行本身
    if (/^\s*!\[/.test(line)) return true
    // 检测列表项中的链接（支持加粗包裹、加粗文字等格式）
    const linkMatch = line.match(
      /^\s*(?:\d+\.\s+|-\s+)\*{0,2}\[([^\]]*)\]\(([^)]+)\)\*{0,2}\s*$/
    )
    if (linkMatch?.[2] && isMatchedUrl(linkMatch[2])) {
      removedCount++
      return false
    }
    return true
  })

  if (removedCount === 0) return content

  // 清理可能变成孤立的标题或引导文本
  const result: string[] = []
  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i] ?? ''
    const trimmedLine = line.trim()

    // 检测 **xxx：** 或 **xxx:** 形式的加粗标题
    if (/^\s*\*\*[^*]+[：:]\*\*\s*$/.test(line)) {
      let j = i + 1
      while (j < filtered.length && (filtered[j] ?? '').trim() === '') j++
      const nextLine = filtered[j] ?? ''
      if (j >= filtered.length || !/^\s*(?:\d+\.\s+|-\s+)/.test(nextLine)) {
        continue // 跳过孤立标题
      }
    }

    // 检测以冒号结尾的引导文本（如"你可以通过以下链接查看："）
    // 条件：行尾为中文或英文冒号，且后续没有紧跟的列表项
    if (/[：:]\s*$/.test(trimmedLine) && trimmedLine.length > 0) {
      let j = i + 1
      while (j < filtered.length && (filtered[j] ?? '').trim() === '') j++
      const nextLine = filtered[j] ?? ''
      // 后续没有列表项内容了，说明这个引导句已孤立
      if (j >= filtered.length || !/^\s*(?:\d+\.\s+|-\s+)/.test(nextLine)) {
        // 尝试去掉句尾的引导部分（"。你可以通过以下链接查看："→ "。"）
        const introPattern = /[，。！？,.!?]\s*[^，。！？,.!?]*(?:链接|查看|如下|下方|点击)[^，。！？,.!?]*[：:]\s*$/
        const cleaned = line.replace(introPattern, (match) => {
          // 只保留原始标点
          const punct = match.charAt(0)
          return /[，。！？,.!?]/.test(punct) ? punct : ''
        })
        if (cleaned !== line) {
          result.push(cleaned)
          continue
        }
        // 如果整行都是引导文本（独立行），直接跳过
        if (/^(?:.*(?:链接|查看|如下|下方|点击).*)?[：:]\s*$/.test(trimmedLine)) {
          continue
        }
      }
    }

    result.push(line)
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** 判断 URL 是否指向视频文件 */
function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    return /\.(mp4|webm|ogg|mov)$/i.test(pathname)
  } catch {
    return /\.(mp4|webm|ogg|mov)(?:\?|#|$)/i.test(url)
  }
}

/**
 * 移除视频链接相关的冗余文本。
 * 当消息中包含视频 URL 时，移除 "视频链接：" 标签前缀和 "点击链接观看" 说明文字。
 */
function removeRedundantVideoText(content: string): string {
  if (!/https?:\/\/[^\s)]+\.(?:mp4|webm|ogg|mov)/i.test(content)) return content

  let result = content
  // 移除 "**视频链接：** " 或 "视频链接：" 前缀（保留后面的 URL）
  result = result.replace(/\*{0,2}视频链接[：:]\*{0,2}\s*/g, '')
  // 移除关于点击链接观看视频的说明文字
  result = result.replace(/你可以直接点击[^。]*(?:观看|查看|下载)[^。]*[。.]\s*/g, '')

  return result.replace(/\n{3,}/g, '\n\n')
}

interface MessageResponseProps {
  /** Markdown 内容 */
  children: string
  className?: string
}

/** 使用 react-markdown 渲染 assistant 消息内容，代码块使用 Shiki 语法高亮 */
export const MessageResponse = React.memo(
  function MessageResponse({ children, className }: MessageResponseProps): React.ReactElement {
    const processedContent = React.useMemo(() => {
      let content = removeRedundantImageLinks(children)
      content = removeRedundantVideoText(content)
      return content
    }, [children])
    return (
      <div
        className={cn(
          'prose dark:prose-invert max-w-none text-[14px]',
          'prose-p:my-1.5 prose-p:leading-[1.6] prose-li:leading-[1.6] prose-pre:my-0 prose-headings:my-2',
          '[&_.code-block-wrapper+.code-block-wrapper]:mt-4',
          '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className
        )}
      >
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt, ...imgProps }) => {
              const [loaded, setLoaded] = React.useState(false)
              const [error, setError] = React.useState(false)

              if (error) {
                return (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    <span>🖼️</span>
                    <a
                      href={src}
                      onClick={(e) => {
                        e.preventDefault()
                        if (src) window.electronAPI.openExternal(src)
                      }}
                      className="underline hover:text-foreground"
                    >
                      {alt || '查看图片'}
                    </a>
                  </span>
                )
              }

              return (
                <span className="block my-3">
                  {!loaded && (
                    <span className="block w-[320px] h-[200px] rounded-xl bg-muted/30 animate-pulse" />
                  )}
                  <img
                    {...imgProps}
                    src={src}
                    alt={alt || '图片'}
                    className={cn(
                      'max-w-full md:max-w-[520px] h-auto rounded-xl shadow-sm cursor-pointer transition-opacity duration-300',
                      loaded ? 'opacity-100' : 'opacity-0 absolute'
                    )}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                    onClick={() => {
                      if (src) window.electronAPI.openExternal(src)
                    }}
                  />
                </span>
              )
            },
            a: ({ href, children: linkChildren, ...linkProps }) => {
              // 视频 URL → 内联播放器
              if (href && isVideoUrl(href)) {
                return (
                  <span className="block my-3">
                    <video
                      src={href}
                      controls
                      preload="metadata"
                      className="max-w-full md:max-w-[520px] h-auto rounded-xl shadow-sm"
                    />
                  </span>
                )
              }
              return (
                <a
                  {...linkProps}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault()
                    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                      window.electronAPI.openExternal(href)
                    }
                  }}
                  title={href}
                >
                  {linkChildren}
                </a>
              )
            },
            pre: ({ children: preChildren }) => {
              // 检测子 <code> 元素的 className 是否包含 language-mermaid
              const codeChild = React.Children.toArray(preChildren).find(
                (child): child is React.ReactElement =>
                  React.isValidElement(child) && (child as React.ReactElement).type === 'code'
              ) as React.ReactElement | undefined

              if (codeChild) {
                const codeProps = codeChild.props as { className?: string; children?: React.ReactNode }
                if (codeProps.className?.includes('language-mermaid')) {
                  // 递归提取纯文本（children 可能是字符串数组）
                  const extractText = (node: React.ReactNode): string => {
                    if (typeof node === 'string') return node
                    if (typeof node === 'number') return String(node)
                    if (!node) return ''
                    if (Array.isArray(node)) return node.map(extractText).join('')
                    if (React.isValidElement(node)) {
                      return extractText((node.props as { children?: React.ReactNode }).children)
                    }
                    return ''
                  }
                  const mermaidCode = extractText(codeProps.children).replace(/\n$/, '')
                  return <MermaidBlock code={mermaidCode} />
                }
              }

              return <CodeBlock>{preChildren}</CodeBlock>
            },
          }}
        >
          {processedContent}
        </Markdown>
      </div>
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

// ===== UserMessageContent 可折叠用户消息 =====

/** 折叠行数阈值 */
const COLLAPSE_LINE_THRESHOLD = 4

interface UserMessageContentProps extends HTMLAttributes<HTMLDivElement> {
  children: string
}

/**
 * 用户消息内容组件
 * - 超过 4 行时默认折叠
 * - 点击展开/收起，带渐变遮罩
 */
export const UserMessageContent = React.memo(
  function UserMessageContent({ children, className, ...props }: UserMessageContentProps): React.ReactElement {
    const [isExpanded, setIsExpanded] = React.useState(false)
    const [shouldCollapse, setShouldCollapse] = React.useState(false)
    const contentRef = React.useRef<HTMLDivElement>(null)

    // 检测内容是否超过阈值行数
    React.useEffect(() => {
      if (!contentRef.current) return

      const element = contentRef.current
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight)
      const maxHeight = lineHeight * COLLAPSE_LINE_THRESHOLD

      // scrollHeight 超过最大高度 + 容差时折叠
      setShouldCollapse(element.scrollHeight > maxHeight + 10)
    }, [children])

    const toggleExpand = React.useCallback(() => {
      setIsExpanded((prev) => !prev)
    }, [])

    return (
      <div className={cn('relative rounded-[10px] bg-foreground/[0.045] dark:bg-foreground/[0.08] px-3.5 py-2.5', className)} {...props}>
        <div
          ref={contentRef}
          className={cn(
            'whitespace-pre-wrap overflow-hidden transition-[max-height] duration-200 text-[14px] leading-[1.6]',
            '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
            shouldCollapse && !isExpanded && 'max-h-[6.5em]'
          )}
        >
          {children}
        </div>
        {shouldCollapse && (
          <button
            type="button"
            onClick={toggleExpand}
            className={cn(
              'flex items-center gap-1 text-xs text-foreground/40 hover:text-foreground/70 transition-colors mt-1',
              !isExpanded &&
                'absolute bottom-0 left-0 right-0 pt-4 bg-gradient-to-t from-foreground/[0.045] dark:from-foreground/[0.08] to-transparent'
            )}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3" />
                <span>收起</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-3" />
                <span>展开全部</span>
              </>
            )}
          </button>
        )}
      </div>
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

// ===== MessageLoading 加载动画 =====

type MessageLoadingProps = HTMLAttributes<HTMLDivElement>

/** 3 个弹跳点加载动画 */
export function MessageLoading({ className, ...props }: MessageLoadingProps): React.ReactElement {
  return (
    <div className={cn('flex items-center gap-1 mt-2', className)} {...props}>
      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  )
}

// ===== MessageStopped 已停止生成 =====

type MessageStoppedProps = HTMLAttributes<HTMLDivElement>

/** "已停止生成" 状态标记 */
export function MessageStopped({ className, ...props }: MessageStoppedProps): React.ReactElement {
  return (
    <div
      className={cn('flex items-center gap-1.5 text-sm text-muted-foreground mt-2', className)}
      {...props}
    >
      <span className="size-2 rounded-full bg-muted-foreground/40" />
      <span>已停止生成</span>
    </div>
  )
}

// ===== MessageAttachments 消息附件展示 =====

interface MessageAttachmentsProps extends HTMLAttributes<HTMLDivElement> {
  /** 附件列表 */
  attachments: FileAttachment[]
}

/** 消息附件容器 */
export function MessageAttachments({
  attachments,
  className,
  ...props
}: MessageAttachmentsProps): React.ReactElement {
  const imageAttachments = attachments.filter((att) => att.mediaType.startsWith('image/'))
  const fileAttachments = attachments.filter((att) => !att.mediaType.startsWith('image/'))
  const isSingleImage = imageAttachments.length === 1 && fileAttachments.length === 0

  return (
    <div className={cn('flex flex-col gap-2 mb-2', className)} {...props}>
      {/* 图片附件 */}
      {imageAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {imageAttachments.map((att) => (
            <MessageAttachmentImage key={att.id} attachment={att} isSingle={isSingleImage} />
          ))}
        </div>
      )}
      {/* 文件附件 */}
      {fileAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileAttachments.map((att) => (
            <MessageAttachmentFile key={att.id} attachment={att} />
          ))}
        </div>
      )}
    </div>
  )
}

// ===== MessageAttachmentImage 图片附件展示 =====

interface MessageAttachmentImageProps {
  attachment: FileAttachment
  /** 是否为唯一附件（单图模式） */
  isSingle?: boolean
}

/** 图片附件展示（单图: max 500px，多图: 280px 方块） */
function MessageAttachmentImage({ attachment, isSingle = false }: MessageAttachmentImageProps): React.ReactElement {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null)

  React.useEffect(() => {
    window.electronAPI
      .readAttachment(attachment.localPath)
      .then((base64) => {
        setImageSrc(`data:${attachment.mediaType};base64,${base64}`)
      })
      .catch((error) => {
        console.error('[MessageAttachmentImage] 读取附件失败:', error)
      })
  }, [attachment.localPath, attachment.mediaType])

  if (!imageSrc) {
    return (
      <div className={cn(
        'rounded-lg bg-muted/30 animate-pulse shrink-0',
        isSingle ? 'w-[280px] h-[200px]' : 'size-[280px]'
      )} />
    )
  }

  return isSingle ? (
    <img
      src={imageSrc}
      alt={attachment.filename}
      className="max-w-[500px] max-h-[min(500px,50vh)] rounded-lg object-contain"
    />
  ) : (
    <img
      src={imageSrc}
      alt={attachment.filename}
      className="size-[280px] rounded-lg object-cover shrink-0"
    />
  )
}

// ===== MessageAttachmentFile 文件附件展示 =====

interface MessageAttachmentFileProps {
  attachment: FileAttachment
}

/** 文件附件展示（标签样式，teal 色调） */
function MessageAttachmentFile({ attachment }: MessageAttachmentFileProps): React.ReactElement {
  /** 截断文件名 */
  const displayName = attachment.filename.length > 20
    ? attachment.filename.slice(0, 17) + '...'
    : attachment.filename

  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#37a5aa]/10 border border-[#37a5aa]/20 px-3 py-1.5 text-[13px] text-[#37a5aa] shrink-0">
      <Paperclip className="size-4" />
      <span>{displayName}</span>
    </div>
  )
}

// ===== StreamingIndicator 流式呼吸脉冲点 =====

type StreamingIndicatorProps = HTMLAttributes<HTMLSpanElement>

/** 流式生成中的呼吸脉冲点指示器 */
export function StreamingIndicator({ className, ...props }: StreamingIndicatorProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-block size-2 rounded-full bg-primary/60 animate-pulse ml-1 align-middle',
        className
      )}
      {...props}
    />
  )
}
