"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Download, ExternalLink, ChevronDown, ChevronUp, X, Eye, ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react";

interface OrderDocument {
  id: string;
  order_id: string;
  document_type: string;
  title: string;
  description: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  download_url: string;
  created_at: string;
  uploaded_by: string;
}

interface DocumentsResponse {
  documents: OrderDocument[];
  total: number;
}

interface OrderDocumentsViewerProps {
  orderId: string;
}

export function OrderDocumentsViewer({ orderId }: OrderDocumentsViewerProps) {
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<OrderDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    fetchDocuments();
  }, [orderId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call orders service to get delivery documents
      const response = await fetch(
        `/api/orders/${orderId}/documents/delivery-proof`
      );

      // Handle all non-OK responses gracefully
      if (!response.ok) {
        console.log(`Documents fetch returned ${response.status} for order ${orderId}`);
        setDocuments([]);
        return;
      }

      const data: DocumentsResponse = await response.json();
      console.log('API Response:', data);
      console.log('Documents from API:', data.documents);
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      // Don't set error for missing documents, just return empty array
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') {
      return <span className="text-red-600 font-bold">PDF</span>;
    }
    if (mimeType.startsWith('image/')) {
      const formatMap: Record<string, string> = {
        'image/jpeg': 'JPG',
        'image/jpg': 'JPG',
        'image/png': 'PNG',
        'image/gif': 'GIF',
        'image/webp': 'WEBP',
        'image/svg+xml': 'SVG',
        'image/bmp': 'BMP',
        'image/tiff': 'TIFF',
        'image/x-icon': 'ICO',
      };
      const format = formatMap[mimeType] || 'IMG';
      return <span className="text-blue-600 font-bold">{format}</span>;
    }
    return <FileText className="w-4 h-4 text-gray-600" />;
  };

  const handleDownload = async (doc: OrderDocument) => {
    try {
      console.log('Downloading document:', doc);
      console.log('Download URL:', doc.download_url);

      // Check if it's a presigned MinIO URL (contains X-Amz-Signature)
      const isPresignedUrl = doc.download_url.includes('X-Amz-Signature') ||
                            doc.download_url.includes('localhost:9000') ||
                            doc.download_url.includes('minio:') ||
                            doc.download_url.includes(':9000');

      console.log('Is presigned URL:', isPresignedUrl);

      let response: Response;

      if (isPresignedUrl) {
        // For presigned URLs, fetch directly without auth headers
        // Add mode: 'cors' to handle CORS properly
        response = await fetch(doc.download_url, {
          mode: 'cors',
          cache: 'no-cache'
        });
      } else {
        // For API routes, include auth headers
        response = await fetch(doc.download_url, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
          }
        });
      }

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }

      // Get the blob with proper MIME type
      const blob = await response.blob();
      console.log('Blob type:', blob.type);
      console.log('Blob size:', blob.size);

      // Create object URL with proper MIME type
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: doc.mime_type || blob.type || 'application/octet-stream' })
      );

      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.style.display = 'none';
      window.document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      console.log('Download completed');
    } catch (error) {
      console.error('Error downloading file:', error);
      // Show error to user
      alert(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePreview = async (doc: OrderDocument) => {
    try {
      console.log('Previewing document:', doc);
      console.log('Preview URL:', doc.download_url);

      // Check if it's a presigned MinIO URL
      const isPresignedUrl = doc.download_url.includes('X-Amz-Signature') ||
                            doc.download_url.includes('localhost:9000') ||
                            doc.download_url.includes('minio:') ||
                            doc.download_url.includes(':9000');

      console.log('Is presigned URL:', isPresignedUrl);

      let url: string;

      // Always fetch the file as blob for proper streaming from MinIO
      // This works for both presigned URLs and API routes
      let response: Response;

      if (isPresignedUrl) {
        // For presigned URLs, fetch directly with CORS mode
        response = await fetch(doc.download_url, {
          mode: 'cors',
          cache: 'no-cache'
        });
      } else {
        // For API routes, include auth headers
        response = await fetch(doc.download_url, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
          }
        });
      }

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
      }

      // Get the blob
      const blob = await response.blob();
      console.log('Blob type:', blob.type);
      console.log('Blob size:', blob.size);

      // Create object URL with explicit MIME type for proper rendering
      const mimeType = doc.mime_type || blob.type || 'application/octet-stream';
      const typedBlob = new Blob([blob], { type: mimeType });
      url = window.URL.createObjectURL(typedBlob);

      console.log('Preview URL created:', url);
      console.log('MIME type used:', mimeType);

      setPreviewUrl(url);
      setPreviewDoc(doc);
    } catch (error) {
      console.error('Error previewing file:', error);
      alert(`Failed to preview file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const closePreview = () => {
    // Revoke object URL if it's one (starts with blob:)
    if (previewUrl && previewUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewDoc(null);
    setZoom(1);
    setRotation(0);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const isPdf = (mimeType: string) => {
    return mimeType === 'application/pdf';
  };

  const toggleImagePreview = (doc: OrderDocument) => {
    if (previewDoc?.id === doc.id) {
      // If already previewing this image, close it
      closePreview();
    } else {
      // Otherwise, preview this image (reset zoom for new image)
      setZoom(1);
      setRotation(0);
      handlePreview(doc);
    }
  };

  if (loading) {
    return (
      <div className="border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">
              Delivery Documents {documents.length > 0 && `(${documents.length})`}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-blue-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-blue-600" />
          )}
        </button>

        {/* Documents List */}
        {expanded && (
          <div className="border-t border-blue-200 bg-white p-3 space-y-3">
            {documents.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No delivery documents uploaded yet</p>
                <p className="text-xs text-gray-400 mt-1">Documents will appear here after driver uploads delivery proof</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Document Header */}
                  <div className="flex items-center justify-between p-3 bg-gray-50">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getFileIcon(doc.mime_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{doc.file_name}</span>
                          <span>•</span>
                          <span>{formatFileSize(doc.file_size)}</span>
                          {doc.created_at && (
                            <>
                              <span>•</span>
                              <span>
                                {new Date(doc.created_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {isImage(doc.mime_type) ? (
                        <button
                          onClick={() => toggleImagePreview(doc)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Toggle preview"
                        >
                          {previewDoc?.id === doc.id ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePreview(doc)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Preview document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download document"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Image Preview - REMOVED, now using modal instead */}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Unified Preview Modal for all document types with zoom controls */}
      {previewDoc && previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(previewDoc.mime_type)}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{previewDoc.title}</h3>
                  <p className="text-xs text-gray-500">{previewDoc.file_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Download button */}
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Download document"
                >
                  <Download className="w-5 h-5" />
                </button>
                {/* Close button */}
                <button
                  onClick={closePreview}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Zoom Controls Toolbar */}
            <div className="flex items-center justify-center gap-2 p-3 bg-gray-100 border-b">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-2 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm border border-gray-200 transition-all"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 text-sm font-medium min-w-[80px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-2 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm border border-gray-200 transition-all"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <button
                onClick={handleRotate}
                className="p-2 bg-white hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200 transition-all"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 bg-white hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200 transition-all"
                title="Reset View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content with Scroll */}
            <div className="flex-1 overflow-auto bg-gray-900 p-4 flex items-center justify-center">
              {isImage(previewDoc.mime_type) ? (
                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={previewUrl}
                    alt={previewDoc.title}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-out'
                    }}
                  />
                </div>
              ) : isPdf(previewDoc.mime_type) ? (
                <div className="w-full h-full flex flex-col">
                  <iframe
                    src={previewUrl}
                    className="flex-1 w-full min-h-[70vh] rounded-lg bg-white"
                    title={previewDoc.title}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-white">
                  <FileText className="w-20 h-20 mb-4 text-gray-400" />
                  <p className="text-gray-300 mb-2">Preview not available for this file type</p>
                  <p className="text-gray-500 text-sm mb-4">{previewDoc.mime_type}</p>
                  <button
                    onClick={() => handleDownload(previewDoc)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
