export default function PageHeader({ icon: Icon, title, description, actions }) {
  return (
    <div className="page-header">
      <div className="page-header__left">
        {Icon && (
          <div className="page-header__icon-wrap">
            <Icon size={20} />
          </div>
        )}
        <div>
          <h1 className="page-header__title">{title}</h1>
          {description && <p className="page-header__desc">{description}</p>}
        </div>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
