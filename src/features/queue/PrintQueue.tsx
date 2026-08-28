import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Files,
  Image as ImageIcon,
  Inbox,
  Leaf,
  Loader2,
  Palette,
  Play,
  SlidersHorizontal,
  Trash,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { QueueItem } from '../../domain/queueTypes';
import { describePageRange } from '../../domain/pageRange';
import {
  calculateBatchMetrics,
  hasFileOverride,
  mergePrintSettings,
  type FileSettingsOverride,
  type PrintSettings,
} from '../../domain/printSettings';

interface PrintQueueProps {
  items: QueueItem[];
  globalSettings: PrintSettings;
  isPrinting: boolean;
  colorEnabled?: boolean;
  duplexEnabled?: boolean;
  onRemove: (id: string) => void;
  onBatchRemove: (ids: string[]) => void;
  onOpenSettings: (id: string) => void;
  onUpdateOverride: (id: string, override: FileSettingsOverride) => void;
  onBatchUpdateOverride: (ids: string[], patch: Partial<FileSettingsOverride>) => void;
  onMoveItem: (id: string, direction: 'up' | 'down') => void;
  onClearQueue: () => void;
  onStartPrint: () => void;
  printDisabled?: boolean;
  onPickFiles?: () => void;
}

function getKindInfo(kind: QueueItem['kind']) {
  switch (kind) {
    case 'pdf':
      return { className: 'file-type-pdf', text: 'PDF' };
    case 'excel':
      return { className: 'file-type-excel', text: 'XLSX' };
    case 'word':
      return { className: 'file-type-word', text: 'DOC' };
    case 'powerpoint':
      return { className: 'file-type-ppt', text: 'PPT' };
    case 'image':
      return { className: 'file-type-img', text: 'IMG' };
    case 'text':
      return { className: 'file-type-txt', text: 'TXT' };
    default:
      return { className: 'file-type-txt', text: 'FILE' };
  }
}

function renderStatusBadge(status: QueueItem['status'], errorMessage?: string) {
  if (status === 'printing') {
    return (
      <span className="status-badge status-printing">
        <Loader2 size={12} className="spin" /> 正在打印...
      </span>
    );
  }
  if (status === 'succeeded') {
    return (
      <span className="status-badge status-success">
        ✓ 打印成功
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <div className="status-cell">
        <span className="status-badge status-failed">
          ✕ 打印失败
        </span>
        {errorMessage && <span className="error-msg" title={errorMessage}>{errorMessage}</span>}
      </div>
    );
  }
  if (status === 'analyzing') {
    return (
      <span className="status-badge status-analyzing">
        <Loader2 size={12} className="spin" /> 页面分析中
      </span>
    );
  }
  return (
    <span className="status-badge status-ready">
      待打印
    </span>
  );
}

export function PrintQueue({
  items,
  globalSettings,
  isPrinting,
  colorEnabled = true,
  duplexEnabled = true,
  onRemove,
  onBatchRemove,
  onOpenSettings,
  onUpdateOverride,
  onBatchUpdateOverride,
  onMoveItem,
  onClearQueue,
  onStartPrint,
  printDisabled = false,
  onPickFiles,
}: PrintQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clean up selected IDs that don't exist anymore
  const validSelectedIds = useMemo(() => {
    const valid = new Set<string>();
    for (const item of items) {
      if (selectedIds.has(item.id)) {
        valid.add(item.id);
      }
    }
    return valid;
  }, [selectedIds, items]);

  const metrics = useMemo(
    () => calculateBatchMetrics(items, globalSettings),
    [items, globalSettings],
  );

  const isAllSelected = items.length > 0 && validSelectedIds.size === items.length;
  const hasSelection = validSelectedIds.size > 0;

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((item) => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleItem = (id: string, checked: boolean) => {
    const next = new Set(validSelectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleQuickToggleColor = (item: QueueItem) => {
    if (isPrinting) return;
    const resolved = mergePrintSettings(globalSettings, item.override);
    const nextColor = resolved.colorMode === 'color' ? 'monochrome' : 'color';
    onUpdateOverride(item.id, {
      ...item.override,
      colorMode: nextColor,
    });
  };

  const handleQuickToggleSides = (item: QueueItem) => {
    if (isPrinting) return;
    const resolved = mergePrintSettings(globalSettings, item.override);
    const nextSides = resolved.sidesMode === 'duplex' ? 'simplex' : 'duplex';
    onUpdateOverride(item.id, {
      ...item.override,
      sidesMode: nextSides,
      flipMode: resolved.flipMode || 'longEdge',
    });
  };

  return (
    <div className="main-workspace-inner">
      {/* 顶部工具条 */}
      <div className="action-toolbar">
        <div className="toolbar-left">
          <div className="batch-selection-box">
            <input
              type="checkbox"
              className="checkbox"
              checked={isAllSelected}
              disabled={isPrinting || items.length === 0}
              onChange={(e) => handleToggleSelectAll(e.target.checked)}
            />
            <span className="selection-count-text">已选 {validSelectedIds.size} 项</span>
          </div>

          <div className="batch-actions-group">
            <button
              type="button"
              className="btn-batch"
              disabled={!hasSelection || isPrinting || !duplexEnabled}
              onClick={() =>
                onBatchUpdateOverride(Array.from(validSelectedIds), {
                  sidesMode: 'duplex',
                  flipMode: 'longEdge',
                })
              }
            >
              <Copy size={13} /> 批量双面
            </button>
            <button
              type="button"
              className="btn-batch"
              disabled={!hasSelection || isPrinting}
              onClick={() =>
                onBatchUpdateOverride(Array.from(validSelectedIds), {
                  sidesMode: 'simplex',
                })
              }
            >
              批量单面
            </button>
            <button
              type="button"
              className="btn-batch"
              disabled={!hasSelection || isPrinting}
              onClick={() =>
                onBatchUpdateOverride(Array.from(validSelectedIds), {
                  colorMode: 'monochrome',
                })
              }
            >
              批量黑白
            </button>
            <button
              type="button"
              className="btn-batch"
              disabled={!hasSelection || isPrinting || !colorEnabled}
              onClick={() =>
                onBatchUpdateOverride(Array.from(validSelectedIds), {
                  colorMode: 'color',
                })
              }
            >
              <Palette size={13} /> 批量彩色
            </button>
            <button
              type="button"
              className="btn-batch btn-batch-danger"
              disabled={!hasSelection || isPrinting}
              onClick={() => {
                onBatchRemove(Array.from(validSelectedIds));
                setSelectedIds(new Set());
              }}
            >
              <Trash2 size={13} /> 批量删除
            </button>
          </div>
        </div>

        {/* 耗材与纸张智能计算条 */}
        <div className="paper-calculator-bar">
          <div className="eco-stat">
            <Files size={14} />
            <span>{metrics.totalFiles} 个文件</span>
          </div>
          <span className="eco-stat-divider">•</span>
          <div className="eco-stat">
            <BookOpen size={14} />
            <span>{metrics.totalPages} 页内容</span>
          </div>
          <span className="eco-stat-divider">•</span>
          <div className="eco-stat">
            <span>预计 {metrics.totalSheets} 张纸 (A4)</span>
          </div>
          {metrics.savedSheets > 0 && (
            <>
              <span className="eco-stat-divider">•</span>
              <div className="eco-stat eco-stat-highlight">
                <Leaf size={14} />
                <span>
                  🌱 节省 {metrics.savedSheets} 张纸 ({metrics.savingPercentage}%)
                </span>
              </div>
            </>
          )}
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="btn-ghost-danger"
            disabled={isPrinting || items.length === 0}
            onClick={onClearQueue}
          >
            <Trash size={14} /> 清空
          </button>
          <button
            type="button"
            className="btn-primary-print"
            disabled={isPrinting || items.length === 0 || printDisabled}
            onClick={onStartPrint}
          >
            {isPrinting ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>打印中...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>开始打印 ({metrics.totalSheets} 张)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 队列内容区域 */}
      <div className="queue-content-wrap">
        {items.length === 0 ? (
          <div className="queue-empty-card">
            <div className="empty-icon-wrap">
              <Inbox size={44} />
            </div>
            <div className="empty-title">队列为空</div>
            <div className="empty-subtitle">
              请在左侧拖放文件、选择文件或通过 Windows 资源管理器右键“发送到”追加
            </div>
            {onPickFiles && (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '12px' }}
                onClick={onPickFiles}
              >
                选择文件追加
              </button>
            )}
          </div>
        ) : (
          <div className="queue-table-card">
            <div className="table-header-row">
              <span>排序</span>
              <span>选</span>
              <span>文件名称与路径</span>
              <span>页数</span>
              <span>打印参数 (快捷微调)</span>
              <span>当前状态</span>
              <span>操作</span>
            </div>

            <div className="queue-list">
              {items.map((item, index) => {
                const isSelected = validSelectedIds.has(item.id);
                const resolved = mergePrintSettings(globalSettings, item.override);
                const isColorOverridden = item.override.colorMode !== undefined;
                const isSidesOverridden = item.override.sidesMode !== undefined;
                const isRangeOverridden = item.override.pageRange !== undefined;
                const kindInfo = getKindInfo(item.kind);

                return (
                  <div
                    key={item.id}
                    className={`queue-row ${isSelected ? 'selected' : ''} ${
                      item.status === 'printing' ? 'printing' : ''
                    } ${item.status === 'failed' ? 'failed' : ''}`}
                  >
                    <div className="row-order-cell">
                      <button
                        type="button"
                        className="btn-order-move"
                        disabled={isPrinting || index === 0}
                        onClick={() => onMoveItem(item.id, 'up')}
                        title="向上移动"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn-order-move"
                        disabled={isPrinting || index === items.length - 1}
                        onClick={() => onMoveItem(item.id, 'down')}
                        title="向下移动"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>

                    <div className="row-check-cell">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={isSelected}
                        disabled={isPrinting}
                        onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                      />
                    </div>

                    <div className="file-info-cell">
                      <div className={`file-type-icon ${kindInfo.className}`}>
                        {kindInfo.text}
                      </div>
                      <div className="file-meta-col">
                        <span className="file-name-text" title={item.fileName}>
                          {item.fileName}
                        </span>
                        <span className="file-path-text" title={item.path}>
                          {item.path}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="page-count-badge">
                        <FileText size={12} style={{ opacity: 0.6 }} />
                        {item.pageCount !== null ? `${item.pageCount} 页` : '—'}
                      </span>
                    </div>

                    <div className="inline-settings-cell">
                      <div className="quick-toggle-bar">
                        <span
                          className={`quick-chip ${isColorOverridden ? 'active-override' : ''}`}
                          onClick={() => handleQuickToggleColor(item)}
                          title="点击快速切换色彩模式"
                        >
                          {resolved.colorMode === 'color' ? '🎨 彩色' : '⚫ 黑白'}
                        </span>
                        <span
                          className={`quick-chip ${isSidesOverridden ? 'active-override' : ''}`}
                          onClick={() => handleQuickToggleSides(item)}
                          title="点击快速切换单双面"
                        >
                          {resolved.sidesMode === 'duplex'
                            ? `📄 双面(${resolved.flipMode === 'shortEdge' ? '短边' : '长边'})`
                            : '📃 单面'}
                        </span>
                        <span
                          className={`quick-chip ${isRangeOverridden ? 'active-override' : ''}`}
                          onClick={() => onOpenSettings(item.id)}
                          title="点击在抽屉中配置自定义页码"
                        >
                          {describePageRange(resolved.pageRange)}
                        </span>
                      </div>
                      <span className="scope-note">
                        {isColorOverridden || isSidesOverridden || isRangeOverridden
                          ? '⚡ 含有独立覆盖'
                          : '· 继承公共设置'}
                      </span>
                    </div>

                    <div className="status-cell">
                      {renderStatusBadge(item.status, item.errorMessage)}
                    </div>

                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn-row-action"
                        title="单文件高级设置"
                        disabled={isPrinting}
                        onClick={() => onOpenSettings(item.id)}
                      >
                        <SlidersHorizontal size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-row-action danger"
                        title="移除此文件"
                        disabled={isPrinting}
                        onClick={() => onRemove(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
