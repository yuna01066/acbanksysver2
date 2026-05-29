import { useAvatarDisplayUrl } from '@/hooks/useAvatarDisplayUrl';

interface ProfileAvatarImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

const ProfileAvatarImage = ({ src, alt = '', className }: ProfileAvatarImageProps) => {
  const displayUrl = useAvatarDisplayUrl(src);

  if (!displayUrl) return null;

  return <img src={displayUrl} alt={alt} className={className} />;
};

export default ProfileAvatarImage;
