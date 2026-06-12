import { t } from '@/i18n';

function PageLoader() {
    return (
        <div className="grid h-screen w-full place-items-center">
            <p>{t('Loading...')}</p>
        </div>
    );
}

export default PageLoader;
