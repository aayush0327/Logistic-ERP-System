'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Progress } from '@/components/ui/Progress';
import { toast } from 'react-hot-toast';
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import {
  useGetUserDocumentsQuery,
  useUploadUserDocumentMutation,
  useDeleteUserDocumentMutation,
  useVerifyUserDocumentMutation
} from '@/services/api/companyApi';
import { UserDocument } from '@/services/api/companyApi';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';

interface DocumentManagerProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  canVerify?: boolean;
}

const documentTypes = [
  { value: 'aadhar_card', label: 'Aadhar Card' },
  { value: 'pan_card', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'educational_certificate', label: 'Educational Certificate' },
  { value: 'experience_certificate', label: 'Experience Certificate' },
  { value: 'photo', label: 'Passport Size Photo' },
  { value: 'resume', label: 'Resume/CV' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'salary_slip', label: 'Salary Slip' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'form_16', label: 'Form 16' },
  { value: 'relieving_letter', label: 'Relieving Letter' },
  { value: 'other', label: 'Other' }
];

export function DocumentManager({ userId, isOpen, onClose, canVerify = false }: DocumentManagerProps) {
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending'>('all');
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const { data: documents, isLoading, refetch } = useGetUserDocumentsQuery({ profileId: userId });

  const [uploadDocument] = useUploadUserDocumentMutation();
  const [deleteDocument] = useDeleteUserDocumentMutation();
  const [verifyDocument] = useVerifyUserDocumentMutation();

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = !searchQuery ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || doc.document_type === filterType;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'verified' && doc.is_verified) ||
      (filterStatus === 'pending' && !doc.is_verified);

    return matchesSearch && matchesType && matchesStatus;
  }) || [];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should not exceed 5MB');
      return;
    }

    try {
      setUploadProgress(prev => ({ ...prev, [documentType]: 0 }));

      const result = await uploadDocument({
        profileId: userId,
        document_type: documentType,
        document_name: file.name,
        file
      }).unwrap();

      setUploadProgress(prev => ({ ...prev, [documentType]: 100 }));

      setTimeout(() => {
        setUploadProgress(prev => {
          const { [documentType]: _, ...rest } = prev;
          return rest;
        });
      }, 2000);

      toast.success(`Document uploaded successfully: ${result.file_name}`);
      refetch();
    } catch (error) {
      toast.error('Failed to upload document');
      setUploadProgress(prev => {
        const { [documentType]: _, ...rest } = prev;
        return rest;
      });
    }

    // Reset file input
    if (fileInputRefs.current[documentType]) {
      fileInputRefs.current[documentType]!.value = '';
    }
  };

  const handleDelete = async (document: UserDocument) => {
    if (!confirm(`Are you sure you want to delete "${document.file_name}"?`)) {
      return;
    }

    try {
      await deleteDocument({
        documentId: document.id
      }).unwrap();

      toast.success('Document deleted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleVerify = async (document: UserDocument) => {
    try {
      await verifyDocument({
        documentId: document.id
      }).unwrap();

      toast.success('Document verified successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to verify document');
    }
  };

  const handleDownload = (doc: UserDocument) => {
    const link = window.document.createElement('a');
    link.href = doc.file_path;
    link.download = doc.file_name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getStatusBadge = (document: UserDocument) => {
    if (document.is_verified) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Verified
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Pending
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Document Manager
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {documentTypes.map((type) => (
                  <div key={type.value} className="relative">
                    {uploadProgress[type.value] !== undefined ? (
                      <div className="border-2 border-blue-500 bg-blue-50 rounded-lg p-4 text-center">
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                          <p className="text-sm font-medium text-blue-900">{type.label}</p>
                          <Progress value={uploadProgress[type.value]} className="h-2" />
                          <p className="text-xs text-blue-600">
                            {uploadProgress[type.value]}% uploaded
                          </p>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[type.value] = el;
                          }}
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, type.value)}
                          accept=".pdf,.jpg,.jpeg,.png"
                        />
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-700">{type.label}</p>
                        <p className="text-xs text-gray-500">Click to upload</p>
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Supported formats: PDF, JPG, PNG (Max size: 5MB)
              </p>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Documents ({filteredDocuments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                      ? 'No documents found matching your criteria'
                      : 'No documents uploaded yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <FileText className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{document.file_name}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-sm text-gray-500">
                              {documentTypes.find(t => t.value === document.document_type)?.label || document.document_type}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatFileSize(document.file_size)}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(document.uploaded_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(document)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload(document)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(document.file_path, '_blank')}>
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {canVerify && !document.is_verified && (
                              <DropdownMenuItem onClick={() => handleVerify(document)}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Verify
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(document)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}