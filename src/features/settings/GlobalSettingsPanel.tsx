import { ChevronDown, HardDrive, Printer, Sliders } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SystemPrinter } from '../../shared/contracts/printer';
import type { ColorMode, FlipMode, PrintSettings, SidesMode } from '../../domain/printSettings';
import { evaluateSettingAvailability } from '../../domain/printSettings';

interface PrinterMenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
}

const PRINTER_MENU_GAP_PIXELS = 6;
const PRINTER_MENU_VIEWPORT_PADDING_PIXELS = 8;
const PRINTER_MENU_PREFERRED_MAX_HEIGHT_PIXELS = 280;

interface GlobalSettingsPanelProps {
  printers: SystemPrinter[];
  settings: PrintSettings;
  loadingPrinters: boolean;
  onChange: (nextSettings: PrintSettings) => void;
}

function describePrinterState(printer: SystemPrinter): string {
  if (printer.state === 'ready') return '在线 · 就绪';
  if (printer.state === 'offline') return '设备离线';
  if (printer.state === 'error') return '错误状态';
  return '状态未知';
}

export function GlobalSettingsPanel({
  printers,
  settings,
  loadingPrinters,
  onChange,
}: GlobalSettingsPanelProps) {
  const selectedPrinter = printers.find((printer) => printer.name === settings.printerName);
  const availability = evaluateSettingAvailability(selectedPrinter);
  const showFlipOptions = settings.sidesMode === 'duplex' && availability.duplexEnabled;
  const showColorHint = Boolean(selectedPrinter) && !availability.colorEnabled;
  const showDuplexHint = Boolean(selectedPrinter) && !availability.duplexEnabled;
  const criticalReasons = availability.reasons.filter(
    (reason) =>
      reason.includes('离线') ||
      reason.includes('错误') ||
      reason.includes('尚未选择'),
  );

  const [printerSelectOpen, setPrinterSelectOpen] = useState(false);
  const printerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const printerMenuRef = useRef<HTMLDivElement | null>(null);
  const [printerMenuPosition, setPrinterMenuPosition] = useState<PrinterMenuPosition | null>(null);
  const printerListboxId = useId();

  const selectedPrinterLabel = selectedPrinter
    ? `${selectedPrinter.name}${selectedPrinter.isDefault ? ' (默认)' : ''}`
    : loadingPrinters
      ? '正在读取系统打印机…'
      : '选择系统打印机';

  const updatePrinterMenuPosition = useCallback(() => {
    const triggerElement = printerTriggerRef.current;
    if (!triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow =
      viewportHeight - triggerRect.bottom - PRINTER_MENU_GAP_PIXELS - PRINTER_MENU_VIEWPORT_PADDING_PIXELS;
    const spaceAbove =
      triggerRect.top - PRINTER_MENU_GAP_PIXELS - PRINTER_MENU_VIEWPORT_PADDING_PIXELS;
    const preferBottom =
      spaceBelow >= Math.min(PRINTER_MENU_PREFERRED_MAX_HEIGHT_PIXELS, 160) || spaceBelow >= spaceAbove;
    const availableHeight = Math.max(120, preferBottom ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(PRINTER_MENU_PREFERRED_MAX_HEIGHT_PIXELS, availableHeight);
    const width = Math.min(
      Math.max(triggerRect.width, 240),
      viewportWidth - PRINTER_MENU_VIEWPORT_PADDING_PIXELS * 2,
    );
    const rawLeft = triggerRect.left;
    const left = Math.min(
      Math.max(PRINTER_MENU_VIEWPORT_PADDING_PIXELS, rawLeft),
      viewportWidth - width - PRINTER_MENU_VIEWPORT_PADDING_PIXELS,
    );
    const top = preferBottom
      ? triggerRect.bottom + PRINTER_MENU_GAP_PIXELS
      : Math.max(
          PRINTER_MENU_VIEWPORT_PADDING_PIXELS,
          triggerRect.top - PRINTER_MENU_GAP_PIXELS - maxHeight,
        );

    setPrinterMenuPosition({
      top,
      left,
      width,
      maxHeight,
      placement: preferBottom ? 'bottom' : 'top',
    });
  }, []);

  useLayoutEffect(() => {
    if (!printerSelectOpen) {
      setPrinterMenuPosition(null);
      return;
    }
    updatePrinterMenuPosition();
  }, [printerSelectOpen, printers.length, updatePrinterMenuPosition]);

  useEffect(() => {
    if (!printerSelectOpen) return;

    const handlePointerDownOutside = (event: MouseEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) return;
      const clickedInsideTrigger = printerTriggerRef.current?.contains(targetNode);
      const clickedInsideMenu = printerMenuRef.current?.contains(targetNode);
      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setPrinterSelectOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPrinterSelectOpen(false);
      }
    };

    const handleViewportChange = () => {
      updatePrinterMenuPosition();
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('keydown', handleEscapeKey);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [printerSelectOpen, updatePrinterMenuPosition]);

  const handleSelectPrinter = (printer: SystemPrinter) => {
    onChange({
      ...settings,
      printerName: printer.name,
      colorMode:
        printer.color.support === 'unsupported' ? 'monochrome' : settings.colorMode,
      sidesMode:
        printer.duplex.support === 'unsupported' ? 'simplex' : settings.sidesMode,
    });
    setPrinterSelectOpen(false);
  };

  const printerMenu =
    printerSelectOpen && printerMenuPosition
      ? createPortal(
          <div
            ref={printerMenuRef}
            id={printerListboxId}
            role="listbox"
            aria-label="系统打印机列表"
            className="printer-picker-menu"
            style={{
              position: 'fixed',
              top: `${printerMenuPosition.top}px`,
              left: `${printerMenuPosition.left}px`,
              width: `${printerMenuPosition.width}px`,
              maxHeight: `${printerMenuPosition.maxHeight}px`,
            }}
          >
            {printers.map((printer) => {
              const isSelected = printer.name === settings.printerName;
              return (
                <button
                  key={printer.name}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`printer-picker-option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => handleSelectPrinter(printer)}
                >
                  <div className="printer-picker-option-name">
                    <span>{printer.name}</span>
                    {printer.isDefault && <span className="default-chip">默认</span>}
                  </div>
                  <div className="printer-picker-option-meta">
                    <span className={`state-dot state-${printer.state}`} />
                    <span>{describePrinterState(printer)}</span>
                    <span>·</span>
                    <span>彩色{printer.color.support === 'supported' ? '支持' : '不支持'}</span>
                    <span>·</span>
                    <span>双面{printer.duplex.support === 'supported' ? '支持' : '不支持'}</span>
                  </div>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {/* 02 / 打印设备 */}
      <div className="rail-section">
        <div className="section-header">
          <span className="section-title">
            <HardDrive size={14} /> 02 / 打印设备
          </span>
          <span
            className="section-link"
            onClick={() => setPrinterSelectOpen((prev) => !prev)}
          >
            切换设备
          </span>
        </div>

        <div className="printer-widget">
          <button
            ref={printerTriggerRef}
            type="button"
            className="printer-selector-btn"
            onClick={() => setPrinterSelectOpen((prev) => !prev)}
          >
            <div className="printer-info-group">
              <div className="printer-avatar">
                <Printer size={16} />
              </div>
              <div className="printer-labels">
                <span className="printer-active-name" title={selectedPrinterLabel}>
                  {selectedPrinterLabel}
                </span>
                <span
                  className={`printer-status-text ${selectedPrinter?.state === 'ready' ? 'status-online' : 'status-offline'}`}
                >
                  <span className="dot" />
                  {selectedPrinter ? describePrinterState(selectedPrinter) : '未选择设备'}
                </span>
              </div>
            </div>
            <ChevronDown size={16} className="caret-icon" />
          </button>
          {printerMenu}

          <div className="printer-caps">
            <span
              className={`cap-pill ${availability.colorEnabled ? 'supported' : 'unsupported'}`}
            >
              {availability.colorEnabled ? '✓' : '✕'} 彩色打印
            </span>
            <span
              className={`cap-pill ${availability.duplexEnabled ? 'supported' : 'unsupported'}`}
            >
              {availability.duplexEnabled ? '✓' : '✕'} 双面翻转
            </span>
            <span className="cap-pill supported">✓ A4 / A3 纸盒</span>
          </div>
        </div>

        {criticalReasons.length > 0 && (
          <div className="alert-banner">
            <span className="alert-icon">⚠️</span>
            <span>{criticalReasons.join('；')}</span>
          </div>
        )}
      </div>

      {/* 03 / 公共设置 */}
      <div className="rail-section">
        <div className="section-header">
          <span className="section-title">
            <Sliders size={14} /> 03 / 公共设置
          </span>
          <span className="section-badge">默认继承</span>
        </div>

        <div className="setting-group-card">
          {/* 色彩模式 */}
          <div className="setting-item">
            <div className="setting-label-row">
              <span>色彩模式</span>
              <span className="setting-sub-hint">
                {settings.colorMode === 'monochrome' ? '黑白 (节约耗材)' : '全彩色高保真'}
              </span>
            </div>
            <div className="setting-segmented">
              <button
                type="button"
                className={`seg-btn ${settings.colorMode === 'monochrome' ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, colorMode: 'monochrome' })}
              >
                ⚫ 黑白
              </button>
              <button
                type="button"
                className={`seg-btn ${settings.colorMode === 'color' ? 'active' : ''}`}
                disabled={!availability.colorEnabled}
                onClick={() => onChange({ ...settings, colorMode: 'color' })}
              >
                🎨 彩色
              </button>
            </div>
            {showColorHint && (
              <span className="field-hint">
                当前打印机不支持彩色
              </span>
            )}
          </div>

          {/* 单双面与翻转 */}
          <div className="setting-item">
            <div className="setting-label-row">
              <span>单双面与装订</span>
              <span className="setting-sub-hint">
                {settings.sidesMode === 'simplex'
                  ? '单面打印'
                  : settings.flipMode === 'longEdge'
                    ? '双面 (翻转长边)'
                    : '双面 (翻转短边)'}
              </span>
            </div>
            <div className="setting-segmented three-cols">
              <button
                type="button"
                className={`seg-btn ${settings.sidesMode === 'simplex' ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, sidesMode: 'simplex' })}
              >
                单面
              </button>
              <button
                type="button"
                className={`seg-btn ${
                  settings.sidesMode === 'duplex' && settings.flipMode === 'longEdge'
                    ? 'active'
                    : ''
                }`}
                disabled={!availability.duplexEnabled}
                onClick={() =>
                  onChange({
                    ...settings,
                    sidesMode: 'duplex',
                    flipMode: 'longEdge',
                  })
                }
              >
                双面长边
              </button>
              <button
                type="button"
                className={`seg-btn ${
                  settings.sidesMode === 'duplex' && settings.flipMode === 'shortEdge'
                    ? 'active'
                    : ''
                }`}
                disabled={!availability.duplexEnabled}
                onClick={() =>
                  onChange({
                    ...settings,
                    sidesMode: 'duplex',
                    flipMode: 'shortEdge',
                  })
                }
              >
                双面短边
              </button>
            </div>
            {showDuplexHint && (
              <span className="field-hint">
                当前打印机不支持硬件双面
              </span>
            )}
          </div>

          {/* 打印份数 */}
          <div className="setting-item">
            <div className="setting-label-row">
              <span>打印份数</span>
              <span className="setting-sub-hint">整批重复份数</span>
            </div>
            <div className="stepper-input">
              <button
                type="button"
                className="stepper-btn"
                onClick={() =>
                  onChange({
                    ...settings,
                    copies: Math.max(1, settings.copies - 1),
                  })
                }
              >
                -
              </button>
              <div className="stepper-val">{settings.copies} 份</div>
              <button
                type="button"
                className="stepper-btn"
                onClick={() =>
                  onChange({
                    ...settings,
                    copies: Math.min(99, settings.copies + 1),
                  })
                }
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
