import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, TextField, Stack, Chip, Tooltip } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import { listQuotePdfs } from '../services/api';

interface QuoteFile {
  name: string;
  url: string;
  updated_at?: string;
  created_at?: string;
  size?: number;
}

export default function QuotesDashboard() {
  const [files, setFiles] = useState<QuoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const timerRef = useRef<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await listQuotePdfs();
      if (resp?.success && Array.isArray(resp.data)) {
        setFiles(resp.data as QuoteFile[]);
      }
    } catch (e) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = window.setInterval(() => {
      fetchData();
    }, 10000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [autoRefresh]);

  const monthRange = useMemo(() => {
    const start = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const end = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);
    return { start, end };
  }, [monthAnchor]);

  const parseFileDate = (f: QuoteFile): Date | null => {
    const iso = f.updated_at || f.created_at;
    if (iso) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
    // Fallback: try to parse timestamp from filename like quote-<ms>-originalname.pdf
    const m = f.name.match(/quote-(\d+)-/i);
    if (m && m[1]) {
      const ms = Number(m[1]);
      if (!Number.isNaN(ms)) {
        const d2 = new Date(ms);
        if (!isNaN(d2.getTime())) return d2;
      }
    }
    return null;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withinMonth = (d: Date | null) => !!d && d >= monthRange.start && d < monthRange.end;
    let list = files.filter(f => withinMonth(parseFileDate(f)));
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q));
    // Sort by date desc then name
    list.sort((a, b) => {
      const da = parseFileDate(a)?.getTime() || 0;
      const db = parseFileDate(b)?.getTime() || 0;
      if (db !== da) return db - da;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [files, query, monthRange.start, monthRange.end]);

  const goPrevMonth = () => {
    setMonthAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setMonthAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return monthAnchor.getFullYear() === now.getFullYear() && monthAnchor.getMonth() === now.getMonth();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5">Quotes Dashboard</Typography>
          <Chip label={`${monthAnchor.toLocaleString(undefined, { month: 'long' })} ${monthAnchor.getFullYear()}`} color="primary" variant="outlined" />
          <IconButton onClick={goPrevMonth} size="small"><NavigateBeforeIcon /></IconButton>
          <IconButton onClick={goNextMonth} size="small" disabled={isCurrentMonth()}><NavigateNextIcon /></IconButton>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Search by filename..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> }}
          />
          <Chip
            label={autoRefresh ? 'Auto: On' : 'Auto: Off'}
            color={autoRefresh ? 'success' : 'default'}
            variant="outlined"
            onClick={() => setAutoRefresh(v => !v)}
          />
          <Tooltip title="Refresh now">
            <span>
              <IconButton color="primary" onClick={fetchData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Filename</TableCell>
                <TableCell sx={{ width: 180 }}>Created</TableCell>
                <TableCell sx={{ width: 180 }}>Updated</TableCell>
                <TableCell sx={{ width: 100 }} align="right">Size</TableCell>
                <TableCell sx={{ width: 80 }} align="center">Open</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={f.name} hover>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>{f.created_at ? new Date(f.created_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>{f.updated_at ? new Date(f.updated_at).toLocaleString() : '-'}</TableCell>
                  <TableCell align="right">{typeof f.size === 'number' ? `${(f.size / 1024).toFixed(1)} KB` : '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton component="a" href={f.url} target="_blank" rel="noopener noreferrer" size="small">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {loading ? 'Loading…' : 'No files found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
