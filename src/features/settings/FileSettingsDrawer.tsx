import {
  Button,
  Drawer,
  Input,
  InputNumber,
  Radio,
  Segmented,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';

import {
  BookOpen,
  Check,
  CheckCheck,
  FileText,
  RotateCw,
  Sliders,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { QueueItem } from '../../domain/queueTypes';
import type {
  ColorMode,
  FileSettingsOverride,
  FlipMode,
  PrintSettings,
  SidesMode,
} from '../../domain/printSettings';
import { mergePrintSettings } from '../../domain/printSettings';
import { parsePageRangeExpression } from '../../domain/pageRange';

interface FileSettingsDrawerProps {
  open: boolean;
  item: QueueItem | null;
  globalSettings: PrintSettings;
  colorEnabled: boolean;
  duplexEnabled: boolean;
  onClose: () => void;
  onSave: (override: FileSettingsOverride) => void;
}

export function formatPageNumbersToRanges(arr: number[]): string {
  if (arr.length === 0) return '';
  const sorted = Array.from(new Set(arr)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}

export function FileSettingsDrawer({
  open,
  item,
  globalSettings,
  colorEnabled,
  duplexEnabled,
  onClose,
  onSave,
}: FileSettingsDrawerProps) {
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [useCustomSides, setUseCustomSides] = useState(false);
  const [useCustomCopies, setUseCustomCopies] = useState(false);
  const [useCustomPages, setUseCustomPages] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('monochrome');
  const [sidesMode, setSidesMode] = useState<SidesMode>('simplex');
  const [flipMode, setFlipMode] = useState<FlipMode>('longEdge');
  const [copies, setCopies] = useState(1);
  const [pageExpression, setPageExpression] = useState('1,3,5-8');
  const [rangeQuickMode, setRangeQuickMode] = useState<'all' | 'odd' | 'even' | 'custom'>('custom');

  useEffect(() => {
    if (!item) {
      return;
    }
    const merged = mergePrintSettings(globalSettings, item.override);
    setUseCustomColor(item.override.colorMode !== undefined);
    setUseCustomSides(
      item.override.sidesMode !== undefined || item.override.flipMode !== undefined,
    );
    setUseCustomCopies(item.override.copies !== undefined);
    setUseCustomPages(item.override.pageRange !== undefined);
    setColorMode(merged.colorMode);
    setSidesMode(merged.sidesMode);
    setFlipMode(merged.flipMode);
    setCopies(merged.copies);

    const initialExpr =
      item.override.pageRange?.expression ||
      (merged.pageRange.mode === 'custom' ? merged.pageRange.expression : '1, 3, 5-8');
    setPageExpression(initialExpr);
    setRangeQuickMode(item.override.pageRange?.mode === 'custom' ? 'custom' : 'all');
  }, [item, globalSettings]);

  const maxPages = useMemo(() => {
    return item?.pageCount && item.pageCount > 0 ? item.pageCount : 12;
  }, [item?.pageCount]);

  const selectedPagesList = useMemo<number[]>(() => {
    if (!useCustomPages) {
      return Array.from({ length: maxPages }, (_, i) => i + 1);
    }
    const parsed = parsePageRangeExpression(pageExpression, maxPages);
    return parsed.ok ? parsed.pages : [];
  }, [useCustomPages, pageExpression, maxPages]);

  const handleTogglePageBlock = (pageNumber: number) => {
    setUseCustomPages(true);
    setRangeQuickMode('custom');
    const isSelected = selectedPagesList.includes(pageNumber);
    let nextPages: number[];
    if (isSelected) {
      nextPages = selectedPagesList.filter((p) => p !== pageNumber);
    } else {
      nextPages = [...selectedPagesList, pageNumber];
    }
    setPageExpression(formatPageNumbersToRanges(nextPages));
  };

  const handleQuickModeChange = (val: 'all' | 'odd' | 'even' | 'custom') => {
    setRangeQuickMode(val);
    if (val === 'all') {
      setUseCustomPages(false);
    } else if (val === 'odd') {
      setUseCustomPages(true);
      const odds = Array.from({ length: maxPages }, (_, i) => i + 1).filter((p) => p % 2 === 1);
      setPageExpression(formatPageNumbersToRanges(odds));
    } else if (val === 'even') {
      setUseCustomPages(true);
      const evens = Array.from({ length: maxPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
      setPageExpression(formatPageNumbersToRanges(evens));
    } else if (val === 'custom') {
      setUseCustomPages(true);
    }
  };

  const handleSave = () => {
    if (!item) {
      return;
    }

    const nextOverride: FileSettingsOverride = {};

    if (useCustomColor) {
      nextOverride.colorMode = colorMode;
    }
    if (useCustomSides) {
      nextOverride.sidesMode = sidesMode;
      nextOverride.flipMode = flipMode;
    }
    if (useCustomCopies) {
      nextOverride.copies = copies;
    }
    if (useCustomPages) {
      const parseResult = parsePageRangeExpression(pageExpression, item.pageCount ?? undefined);
      if (!parseResult.ok) {
        message.error(parseResult.message);
        return;
      }
      nextOverride.pageRange = {
        mode: 'custom',
        expression: pageExpression.trim(),
      };
    }

    onSave(nextOverride);
    onClose();
  };

  return (
    <Drawer
      title="单文件高级设置"
      open={open}
      onClose={onClose}
      width={460}
      destroyOnClose
      className="file-settings-drawer"
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" icon={<Check size={14} />} onClick={handleSave}>
            保存设置
          </Button>
        </Space>
      }
    >
      {item && (
        <div className="drawer-file-meta-card">
          <div className="drawer-file-header">
            <FileText size={18} className="drawer-file-icon" />
            <div className="drawer-file-info">
              <Tooltip title={item.fileName} placement="bottomLeft">
                <Typography.Text strong className="drawer-file-name">
                  {item.fileName}
                </Typography.Text>
              </Tooltip>
              <div className="drawer-file-path" title={item.path}>
                {item.path}
              </div>
            </div>
          </div>
          <div className="drawer-meta-badges">
            <Tag color="blue">{item.kind.toUpperCase()}</Tag>
            <Tag color="cyan">{item.pageCount ? `${item.pageCount} 页` : '页数待定'}</Tag>
          </div>
        </div>
      )}

      <Typography.Paragraph type="secondary" className="drawer-help-text">
        开启开关可单独覆盖公共参数，未开启项将自动继承公共默认值。
      </Typography.Paragraph>

      {/* 页码范围可视化网格选择 */}
      <div className="drawer-section-box">
        <div className="drawer-field-head">
          <div className="field-title-group">
            <BookOpen size={15} />
            <Typography.Text strong>页码范围选择</Typography.Text>
          </div>
          <Switch checked={useCustomPages} onChange={setUseCustomPages} />
        </div>

        <div className="page-mode-row">
          <Segmented
            size="small"
            value={useCustomPages ? rangeQuickMode : 'all'}
            onChange={(val) => handleQuickModeChange(val as 'all' | 'odd' | 'even' | 'custom')}
            options={[
              { label: '全部页', value: 'all' },
              { label: '仅奇数页', value: 'odd' },
              { label: '仅偶数页', value: 'even' },
              { label: '自定义', value: 'custom' },
            ]}
          />
        </div>

        <div className="page-range-input-wrap">
          <Input
            disabled={!useCustomPages}
            value={pageExpression}
            placeholder="例如 1, 3, 5-8"
            onChange={(e) => {
              setPageExpression(e.target.value);
              setRangeQuickMode('custom');
            }}
          />
          <div className="range-summary-text">
            已勾选 {selectedPagesList.length} / {maxPages} 页
          </div>
        </div>

        {/* 可视化页面缩略方块网格 */}
        <div className="visual-page-grid-container">
          <div className="grid-label">点击缩略方块勾选/取消对应页码：</div>
          <div className="visual-page-grid">
            {Array.from({ length: Math.min(maxPages, 48) }, (_, i) => i + 1).map((p) => {
              const isSelected = selectedPagesList.includes(p);
              return (
                <div
                  key={p}
                  className={`page-grid-block ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleTogglePageBlock(p)}
                  title={`第 ${p} 页 (点击切换)`}
                >
                  <span className="page-num">{p}</span>
                  {isSelected && <CheckCheck size={10} className="check-icon" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 颜色模式 */}
      <div className="drawer-section-box">
        <div className="drawer-field-head">
          <div className="field-title-group">
            <Typography.Text strong>色彩模式覆盖</Typography.Text>
          </div>
          <Switch checked={useCustomColor} onChange={setUseCustomColor} />
        </div>
        <Radio.Group
          disabled={!useCustomColor || !colorEnabled}
          value={colorMode}
          onChange={(event) => setColorMode(event.target.value as ColorMode)}
          buttonStyle="solid"
        >
          <Radio.Button value="monochrome">⚫ 黑白模式</Radio.Button>
          <Radio.Button value="color">🎨 全彩模式</Radio.Button>
        </Radio.Group>
      </div>

      {/* 单双面与翻转方式 */}
      <div className="drawer-section-box">
        <div className="drawer-field-head">
          <div className="field-title-group">
            <Typography.Text strong>单双面与翻转</Typography.Text>
          </div>
          <Switch checked={useCustomSides} onChange={setUseCustomSides} />
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Radio.Group
            disabled={!useCustomSides}
            value={sidesMode}
            onChange={(event) => setSidesMode(event.target.value as SidesMode)}
            buttonStyle="solid"
          >
            <Radio.Button value="simplex">📃 单面打印</Radio.Button>
            <Radio.Button value="duplex" disabled={!duplexEnabled}>
              📄 双面打印
            </Radio.Button>
          </Radio.Group>

          {sidesMode === 'duplex' && duplexEnabled && (
            <Radio.Group
              disabled={!useCustomSides}
              value={flipMode}
              onChange={(event) => setFlipMode(event.target.value as FlipMode)}
            >
              <Radio.Button value="longEdge">长边翻转 (如同翻书)</Radio.Button>
              <Radio.Button value="shortEdge">短边翻转 (如同挂历)</Radio.Button>
            </Radio.Group>
          )}
        </Space>
      </div>

      {/* 打印份数 */}
      <div className="drawer-section-box">
        <div className="drawer-field-head">
          <div className="field-title-group">
            <Typography.Text strong>单文件份数</Typography.Text>
          </div>
          <Switch checked={useCustomCopies} onChange={setUseCustomCopies} />
        </div>
        <InputNumber
          min={1}
          max={99}
          disabled={!useCustomCopies}
          value={copies}
          addonAfter="份"
          onChange={(value) => setCopies(typeof value === 'number' && value > 0 ? value : 1)}
        />
      </div>
    </Drawer>
  );
}
