import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Database,
  FileText,
  Activity,
  RefreshCw,
  Settings,
  Users,
  Mail,
  Calendar,
  Info,
} from "lucide-react";

interface ConsentRecord {
  consent_type: string;
  consent_given: boolean;
  granted_at?: string;
  updated_at: string;
  details?: {
    scope?: string;
    purpose?: string;
    retention_days?: number;
  };
}

interface DataUsage {
  data_type: string;
  last_accessed: string;
  access_count: number;
  size_mb: number;
  retention_until: string;
}

interface PrivacyDashboard {
  consent_records: ConsentRecord[];
  data_usage: DataUsage[];
  recent_access_logs: Array<{
    timestamp: string;
    action: string;
    data_type: string;
    details: string;
  }>;
  data_exports: Array<{
    id: string;
    export_type: string;
    requested_at: string;
    status: "pending" | "processing" | "completed" | "failed";
    download_url?: string;
  }>;
  deletion_requests: Array<{
    id: string;
    deletion_type: string;
    requested_at: string;
    status: "pending" | "processing" | "completed" | "failed";
    data_types: string[];
  }>;
}

const PrivacyControls: React.FC = () => {
  const [dashboard, setDashboard] = useState<PrivacyDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [exportType, setExportType] = useState("full");
  const [deletionType, setDeletionType] = useState("partial_data");
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("consent");

  useEffect(() => {
    fetchPrivacyDashboard();
  }, []);

  const fetchPrivacyDashboard = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("/api/privacy/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Failed to fetch privacy dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateConsent = async (
    consentType: string,
    consentGiven: boolean,
    details?: any,
  ) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/privacy/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consent_records: [
            {
              consent_type: consentType,
              consent_given: consentGiven,
              details,
            },
          ],
        }),
      });

      if (response.ok) {
        await fetchPrivacyDashboard();
      }
    } catch (error) {
      console.error("Failed to update consent:", error);
    }
  };

  const requestDataExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/privacy/export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          export_type: exportType,
        }),
      });

      if (response.ok) {
        setShowExportDialog(false);
        await fetchPrivacyDashboard();
      }
    } catch (error) {
      console.error("Failed to request data export:", error);
    }
  };

  const requestDataDeletion = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deletion_type: deletionType,
          data_types: selectedDataTypes,
          reason: "User requested privacy control",
        }),
      });

      if (response.ok) {
        setShowDeleteDialog(false);
        await fetchPrivacyDashboard();
      }
    } catch (error) {
      console.error("Failed to request data deletion:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (sizeMb: number) => {
    if (sizeMb < 1) {
      return `${Math.round(sizeMb * 1024)} KB`;
    } else if (sizeMb < 1024) {
      return `${Math.round(sizeMb * 10) / 10} MB`;
    } else {
      return `${Math.round((sizeMb / 1024) * 10) / 10} GB`;
    }
  };

  const getConsentStatusColor = (consentGiven: boolean) => {
    return consentGiven
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const getDataTypeIcon = (dataType: string) => {
    const icons = {
      calendar_events: <Calendar className="w-4 h-4" />,
      email_messages: <Mail className="w-4 h-4" />,
      contacts: <Users className="w-4 h-4" />,
      notifications: <Shield className="w-4 h-4" />,
      conversations: <Activity className="w-4 h-4" />,
      user_settings: <Settings className="w-4 h-4" />,
    };
    return (
      icons[dataType as keyof typeof icons] || <Database className="w-4 h-4" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading privacy dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Privacy Control Center
          </h2>
          <p className="text-gray-600">
            Manage your data privacy and consent preferences
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowExportDialog(true)} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button onClick={() => setShowDeleteDialog(true)} variant="outline">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Data
          </Button>
        </div>
      </div>

      {/* Privacy Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Consents</p>
                <p className="text-2xl font-bold text-green-600">
                  {dashboard?.consent_records?.filter((c) => c.consent_given)
                    .length || 0}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Data Types</p>
                <p className="text-2xl font-bold text-blue-600">
                  {dashboard?.data_usage?.length || 0}
                </p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recent Access</p>
                <p className="text-2xl font-bold text-purple-600">
                  {dashboard?.recent_access_logs?.length || 0}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Size</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatFileSize(
                    dashboard?.data_usage?.reduce(
                      (sum, d) => sum + d.size_mb,
                      0,
                    ) || 0,
                  )}
                </p>
              </div>
              <FileText className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="consent">Consent Management</TabsTrigger>
          <TabsTrigger value="data">Data Usage</TabsTrigger>
          <TabsTrigger value="access">Access Logs</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="consent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Processing Consent</CardTitle>
              <p className="text-sm text-gray-600">
                Control how your data is processed and used by the Personal Life
                OS
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.consent_records?.map((consent) => (
                  <div
                    key={consent.consent_type}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium capitalize">
                          {consent.consent_type.replace(/_/g, " ")}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {consent.details?.purpose ||
                            "Core functionality and service operation"}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          className={getConsentStatusColor(
                            consent.consent_given,
                          )}
                        >
                          {consent.consent_given ? "Granted" : "Denied"}
                        </Badge>
                        <Switch
                          checked={consent.consent_given}
                          onCheckedChange={(checked) =>
                            updateConsent(
                              consent.consent_type,
                              checked,
                              consent.details,
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Scope:</span>
                        <p>{consent.details?.scope || "Essential features"}</p>
                      </div>
                      <div>
                        <span className="font-medium">Retention:</span>
                        <p>
                          {consent.details?.retention_days
                            ? `${consent.details.retention_days} days`
                            : "As needed"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Last Updated:</span>
                        <p>{formatDate(consent.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Usage Overview</CardTitle>
              <p className="text-sm text-gray-600">
                See what data is stored and how it's being used
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.data_usage?.map((data) => (
                  <div key={data.data_type} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-gray-100 rounded-full">
                          {getDataTypeIcon(data.data_type)}
                        </div>
                        <div>
                          <h4 className="font-medium capitalize">
                            {data.data_type.replace(/_/g, " ")}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Size:</span>
                              <p>{formatFileSize(data.size_mb)}</p>
                            </div>
                            <div>
                              <span className="font-medium">
                                Last Accessed:
                              </span>
                              <p>{formatDate(data.last_accessed)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Access Count:</span>
                              <p>{data.access_count} times</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">
                        Retained until {formatDate(data.retention_until)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Access Logs</CardTitle>
              <p className="text-sm text-gray-600">
                Audit trail of data access and operations
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {dashboard?.recent_access_logs?.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded"
                  >
                    <div className="p-1 bg-blue-100 rounded">
                      {getDataTypeIcon(log.data_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{log.action}</span>
                        <Badge variant="secondary" className="text-xs">
                          {log.data_type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{log.details}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {/* Data Export Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Data Export Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.data_exports?.length === 0 ? (
                <p className="text-gray-500">No export requests</p>
              ) : (
                <div className="space-y-2">
                  {dashboard?.data_exports?.map((exportReq) => (
                    <div
                      key={exportReq.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <span className="font-medium capitalize">
                          {exportReq.export_type} Export
                        </span>
                        <p className="text-sm text-gray-600">
                          Requested: {formatDate(exportReq.requested_at)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(exportReq.status)}>
                          {exportReq.status}
                        </Badge>
                        {exportReq.status === "completed" &&
                          exportReq.download_url && (
                            <Button size="sm" variant="outline">
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Deletion Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Data Deletion Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.deletion_requests?.length === 0 ? (
                <p className="text-gray-500">No deletion requests</p>
              ) : (
                <div className="space-y-2">
                  {dashboard?.deletion_requests?.map((deleteReq) => (
                    <div
                      key={deleteReq.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <span className="font-medium capitalize">
                          {deleteReq.deletion_type.replace(/_/g, " ")}
                        </span>
                        <p className="text-sm text-gray-600">
                          Requested: {formatDate(deleteReq.requested_at)}
                        </p>
                        <div className="flex space-x-1 mt-1">
                          {deleteReq.data_types.map((type, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs"
                            >
                              {type.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Badge className={getStatusColor(deleteReq.status)}>
                        {deleteReq.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Data Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Your Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You can export your personal data in a machine-readable format.
                This process may take a few minutes for large datasets.
              </AlertDescription>
            </Alert>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Export Type
              </label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Data Export</SelectItem>
                  <SelectItem value="calendar_only">
                    Calendar Data Only
                  </SelectItem>
                  <SelectItem value="email_only">Email Data Only</SelectItem>
                  <SelectItem value="contacts_only">Contacts Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowExportDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={requestDataExport}>
                <Download className="w-4 h-4 mr-2" />
                Request Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Data Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Your Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-600">
                <strong>Warning:</strong> Data deletion is permanent and cannot
                be undone. Consider exporting your data first.
              </AlertDescription>
            </Alert>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Deletion Type
              </label>
              <Select value={deletionType} onValueChange={setDeletionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partial_data">
                    Partial Data Deletion
                  </SelectItem>
                  <SelectItem value="full_account">
                    Full Account Deletion
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deletionType === "partial_data" && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Select Data Types to Delete
                </label>
                <div className="space-y-2">
                  {[
                    "calendar_events",
                    "email_messages",
                    "contacts",
                    "notifications",
                  ].map((type) => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedDataTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDataTypes([...selectedDataTypes, type]);
                          } else {
                            setSelectedDataTypes(
                              selectedDataTypes.filter((t) => t !== type),
                            );
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="capitalize">
                        {type.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={requestDataDeletion}
                variant="destructive"
                disabled={
                  deletionType === "partial_data" &&
                  selectedDataTypes.length === 0
                }
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Request Deletion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrivacyControls;
