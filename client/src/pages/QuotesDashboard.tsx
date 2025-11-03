import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, TextField, Stack, Chip, Tooltip } from '@mui/material';
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(f => f.name.toLowerCase().includes(q));
  }, [files, query]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, width: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Quotes Dashboard</Typography>
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
