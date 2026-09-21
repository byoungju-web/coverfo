import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import { useState } from 'react';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { useNetlifyDeploy } from '~/components/deploy/NetlifyDeploy.client';
import { useGitHubDeploy } from '~/components/deploy/GitHubDeploy.client';
import { GitHubDeploymentDialog } from '~/components/deploy/GitHubDeploymentDialog';

interface DeployButtonProps {
  onNetlifyDeploy?: () => Promise<void>;
  onGitHubDeploy?: () => Promise<void>;
}

export const DeployButton = ({ onNetlifyDeploy, onGitHubDeploy }: DeployButtonProps) => {
  const netlifyConn = useStore(netlifyConnection);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTo, setDeployingTo] = useState<'netlify' | 'github' | null>(null);
  const isStreaming = useStore(streamingState);
  const { handleNetlifyDeploy } = useNetlifyDeploy();
  const { handleGitHubDeploy } = useGitHubDeploy();
  const [showGitHubDeploymentDialog, setShowGitHubDeploymentDialog] = useState(false);
  const [githubDeploymentFiles, setGithubDeploymentFiles] = useState<Record<string, string> | null>(null);
  const [githubProjectName, setGithubProjectName] = useState('');

  /*
   * 계정 없이 배포: 만든 파일을 내려받고 netlify.com/drop 을 새 탭으로 엽니다.
   * 내려받은 파일을 그 화면에 끌어다 놓으면 바로 인터넷에 올라갑니다.
   */
  const handleDropDeploy = () => {
    const all = workbenchStore.files.get();
    const targets = Object.keys(all).filter((p) => {
      const f = all[p];
      return f?.type === 'file' && !p.endsWith('server.js') && !p.endsWith('package.json');
    });

    targets.forEach((p) => {
      const f = all[p];

      if (f?.type !== 'file') {
        return;
      }

      const name = p.split('/').pop() || 'index.html';
      const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    window.open('https://app.netlify.com/drop', '_blank', 'noopener');
  };

  const handleNetlifyDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('netlify');

    try {
      if (onNetlifyDeploy) {
        await onNetlifyDeploy();
      } else {
        await handleNetlifyDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleGitHubDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('github');

    try {
      if (onGitHubDeploy) {
        await onGitHubDeploy();
      } else {
        const result = await handleGitHubDeploy();

        if (result && result.success && result.files) {
          setGithubDeploymentFiles(result.files);
          setGithubProjectName(result.projectName);
          setShowGitHubDeploymentDialog(true);
        }
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  return (
    <>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            disabled={isDeploying || !activePreview || isStreaming}
            className="rounded-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.7"
          >
            {isDeploying ? `Deploying to ${deployingTo}...` : 'Deploy'}
            <span className={classNames('i-ph:caret-down transition-transform')} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className={classNames(
              'z-[250]',
              'bg-bolt-elements-background-depth-2',
              'rounded-lg shadow-lg',
              'border border-bolt-elements-borderColor',
              'animate-in fade-in-0 zoom-in-95',
              'py-1',
            )}
            sideOffset={5}
            align="end"
          >
            {/* 계정 없이 바로 배포 — 초보자용 */}
            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': !activePreview,
                },
              )}
              disabled={!activePreview}
              onClick={handleDropDeploy}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/netlify"
                alt="netlify drop"
              />
              <span className="mx-auto">계정 없이 바로 배포 (netlify.com/drop)</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview || !netlifyConn.user,
                },
              )}
              disabled={isDeploying || !activePreview || !netlifyConn.user}
              onClick={handleNetlifyDeployClick}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/netlify"
              />
              <span className="mx-auto">
                {!netlifyConn.user ? 'No Netlify Account Connected' : 'Deploy to Netlify'}
              </span>
              {netlifyConn.user && <NetlifyDeploymentLink />}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview,
                },
              )}
              disabled={isDeploying || !activePreview}
              onClick={handleGitHubDeployClick}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/github"
                alt="github"
              />
              <span className="mx-auto">Deploy to GitHub</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {/* GitHub Deployment Dialog */}
      {showGitHubDeploymentDialog && githubDeploymentFiles && (
        <GitHubDeploymentDialog
          isOpen={showGitHubDeploymentDialog}
          onClose={() => setShowGitHubDeploymentDialog(false)}
          projectName={githubProjectName}
          files={githubDeploymentFiles}
        />
      )}
    </>
  );
};
