import { useI18n } from "@/shared/i18n"

type PageHeaderProps = {
  title: string
  description: string
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border bg-background px-4 py-3">
      <h1 className="text-[13px] font-semibold text-foreground">{title}</h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
    </header>
  )
}

type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const { t } = useI18n()
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} description={description} />
      <div className="flex flex-1 items-center justify-center p-6 text-[12px] text-muted-foreground">
        {t("placeholder.comingSoon", { title })}
      </div>
    </div>
  )
}
