import { GithubIcon } from "@/assets/icons";
import { LINKS } from "@/constants/links";

const OpenSourceBadge = () => {
  return (
    <a href={LINKS.SOCIALS.GITHUB} target="_blank" rel="noopener noreferrer">
      <div className="bg-muted-foreground/10 hover:bg-primary/10 hover:text-primary mb-2 flex flex-row items-center gap-2 rounded-none px-2 py-1 duration-200">
        <GithubIcon height={16} width={16} />
        <div className="urbanist text-xs">Proudly Open Source</div>
      </div>
    </a>
  );
};

export default OpenSourceBadge;
