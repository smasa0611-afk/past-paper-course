"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

function toHiragana(text: string) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeJapaneseText(text: string) {
  return toHiragana(text.normalize("NFKC").replace(/\s+/g, "").toLowerCase());
}

type SearchableSelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  popularOptions?: string[];
  disabled?: boolean;
  className?: string;
};

export default function SearchableSelect({ label, value, options, onChange, placeholder = "入力して絞り込み", emptyMessage = "該当する候補がありません", popularOptions = [], disabled = false, className = "" }: SearchableSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => setQuery(value), [value]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const normalizedQuery = useMemo(() => normalizeJapaneseText(query), [query]);
  const filteredOptions = useMemo(() => {
    const distinct = [...new Set(options.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
    if (!normalizedQuery) {
      const curated = [...new Set(popularOptions.filter(Boolean))];
      return curated.length ? curated : distinct.slice(0, 12);
    }
    const starts: string[] = [];
    const includes: string[] = [];
    distinct.forEach((option) => {
      const normalized = normalizeJapaneseText(option);
      if (!normalized.includes(normalizedQuery)) return;
      if (normalized.startsWith(normalizedQuery)) starts.push(option);
      else includes.push(option);
    });
    return [...starts, ...includes].slice(0, 30);
  }, [normalizedQuery, options, popularOptions]);

  useEffect(() => setHighlightedIndex(0), [normalizedQuery, open]);

  const handleSelect = (option: string) => {
    onChange(option);
    setQuery(option);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setOpen(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      event.preventDefault();
      return;
    }
    if (!filteredOptions.length) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery(value);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      handleSelect(filteredOptions[highlightedIndex] ?? filteredOptions[0]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery(value);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="mb-2 block text-sm font-bold text-[#20345d]">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6d84c0]" />
        <input ref={inputRef} type="text" value={query} disabled={disabled} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={handleKeyDown} className="glass-input glass-combobox w-full py-3.5 pl-11 pr-20 text-sm" role="combobox" aria-expanded={open} aria-controls={listboxId} aria-autocomplete="list" aria-label={label} />
        {query && !disabled && <button type="button" onClick={handleClear} className="absolute right-11 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#7b8fb8] transition hover:bg-white/80 hover:text-[#20345d]" aria-label={`${label}をクリア`}><X className="h-4 w-4" /></button>}
        <button type="button" disabled={disabled} onClick={() => setOpen((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#6178a8] transition hover:bg-white/70 disabled:hover:bg-transparent" aria-label={`${label}の候補を表示`}><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>
      </div>
      {open && !disabled && <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-[24px] border border-[rgba(140,166,235,0.42)] bg-[linear-gradient(180deg,rgba(252,253,255,0.96),rgba(240,246,255,0.94))] shadow-[0_24px_64px_rgba(8,16,38,0.28)] backdrop-blur-xl"><div className="border-b border-[rgba(146,170,235,0.3)] bg-white/70 px-4 py-3 text-[11px] font-bold tracking-[0.22em] text-[#6882c2]">{normalizedQuery ? "SEARCH RESULT" : "POPULAR / SUGGESTIONS"}</div><ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-2">{filteredOptions.length > 0 ? filteredOptions.map((option, index) => { const active = index === highlightedIndex; const selected = option === value; return <li key={option} role="option" aria-selected={selected}><button type="button" onMouseEnter={() => setHighlightedIndex(index)} onClick={() => handleSelect(option)} className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${active ? "bg-[linear-gradient(90deg,rgba(93,124,255,0.18),rgba(148,117,255,0.12))] text-[#132445]" : "bg-transparent text-[#31486f] hover:bg-[rgba(255,255,255,0.82)]"}`}><span className="truncate">{option}</span>{selected && <Check className="ml-3 h-4 w-4 flex-shrink-0 text-[#4f7cff]" />}</button></li>; }) : <li className="px-4 py-5 text-sm text-[#62769d]">{emptyMessage}</li>}</ul></div>}
    </div>
  );
}
