"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Star } from "lucide-react";
import type { FollowUpSurvey } from "@/lib/types";
import type { FollowUpSurveyStats } from "@/lib/queries";
import {
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_COLORS,
  formatPhone,
  formatDate,
  formatDateTime,
} from "@/lib/constants";

function RatingCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {value}
    </span>
  );
}

export function FollowUpSurveysTable({
  surveys,
  stats,
}: {
  surveys: FollowUpSurvey[];
  stats: FollowUpSurveyStats;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return surveys.filter((s) => {
      const matchesSearch =
        !search ||
        s.customer_phone.includes(search) ||
        s.quote_id?.toLowerCase().includes(search.toLowerCase()) ||
        s.salesperson_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.branch?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || s.survey_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [surveys, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Surveys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pending} pending · {stats.sent} sent · {stats.completed} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              of sent surveys completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Purchase Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.purchaseRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.purchaseMadeCount} purchases from {stats.completed} responses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Bot Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgBotRating !== null ? stats.avgBotRating.toFixed(1) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Store: {stats.avgStoreServiceRating !== null ? stats.avgStoreServiceRating.toFixed(1) : "—"} ·
              Sales: {stats.avgSalespersonRating !== null ? stats.avgSalespersonRating.toFixed(1) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top salespeople + branch ratings */}
      {(stats.topSalespeople.length > 0 || stats.byBranch.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.topSalespeople.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Top-Rated Salespeople
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.topSalespeople.map((sp) => (
                  <div key={sp.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{sp.name}</span>
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {sp.avgRating.toFixed(1)}
                      </span>
                      ({sp.count} {sp.count === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {stats.byBranch.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Branch Service Ratings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.byBranch.map((b) => (
                  <div key={b.branch} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{b.branch}</span>
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {b.avgRating.toFixed(1)}
                      </span>
                      ({b.count} {b.count === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by phone, quote ID, salesperson, or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Survey Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(SURVEY_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Surveys table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Quote ID</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead className="text-center">Store</TableHead>
                <TableHead>Salesperson</TableHead>
                <TableHead className="text-center">Sales Rating</TableHead>
                <TableHead className="text-center">Bot Rating</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    No surveys found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPhone(survey.customer_phone)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {survey.quote_id || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {survey.branch || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={SURVEY_STATUS_COLORS[survey.survey_status] || SURVEY_STATUS_COLORS.pending}>
                      {SURVEY_STATUS_LABELS[survey.survey_status] || survey.survey_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {survey.purchase_made === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : survey.purchase_made ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                        Yes
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                        No
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <RatingCell value={survey.store_service_rating} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {survey.salesperson_name || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <RatingCell value={survey.salesperson_rating} />
                  </TableCell>
                  <TableCell className="text-center">
                    <RatingCell value={survey.bot_rating} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={survey.customer_feedback || ""}>
                    {survey.customer_feedback || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(survey.sent_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(survey.completed_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {surveys.length} surveys
      </p>
    </div>
  );
}
