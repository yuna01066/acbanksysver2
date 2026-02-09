import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  userId: string;
  avatarUrl: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onUploaded?: (url: string) => void;
}

const sizeMap = {
  sm: 'w-9 h-9 text-sm rounded-lg',
  md: 'w-14 h-14 text-xl rounded-xl',
  lg: 'w-20 h-20 text-2xl rounded-2xl',
};

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  userId, avatarUrl, name, size = 'md', editable = false, onUploaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(avatarUrl);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const urlWithCache = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCache })
        .eq('id', userId);

      if (updateError) throw updateError;

      setCurrentUrl(urlWithCache);
      onUploaded?.(urlWithCache);
      toast.success('프로필 사진이 업로드되었습니다.');
    } catch (err: any) {
      toast.error('업로드 실패: ' + (err.message || ''));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initial = name?.charAt(0) || '?';

  return (
    <div className="relative group inline-block">
      <div className={cn(
        sizeMap[size],
        "bg-gradient-to-br from-primary/25 to-primary/5 flex items-center justify-center font-bold text-primary shrink-0 overflow-hidden"
      )}>
        {currentUrl ? (
          <img src={currentUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>

      {editable && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
              sizeMap[size].includes('rounded-2xl') ? 'rounded-2xl' : sizeMap[size].includes('rounded-xl') ? 'rounded-xl' : 'rounded-lg'
            )}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            ) : (
              <Camera className="h-4 w-4 text-white" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </>
      )}
    </div>
  );
};

export default AvatarUpload;
