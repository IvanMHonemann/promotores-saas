-- Módulo visitCheckIn (check-in/out de visitas), independente de fieldOperations (lojas/roteiros/fotos).
-- Default ON para quem já tinha fieldOperations no plano ou em override — clientes atuais não mudam de comportamento.

INSERT INTO `subscription_plan_features` (`planId`, `featureKey`, `enabled`)
SELECT spf.`planId`, 'visitCheckIn', spf.`enabled`
FROM `subscription_plan_features` spf
WHERE spf.`featureKey` = 'fieldOperations'
  AND NOT EXISTS (
    SELECT 1 FROM `subscription_plan_features` x
    WHERE x.`planId` = spf.`planId` AND x.`featureKey` = 'visitCheckIn'
  );

INSERT INTO `subscription_plan_features` (`planId`, `featureKey`, `enabled`)
SELECT p.`id`, 'visitCheckIn', 0
FROM `subscription_plans` p
WHERE NOT EXISTS (
  SELECT 1 FROM `subscription_plan_features` x
  WHERE x.`planId` = p.`id` AND x.`featureKey` = 'visitCheckIn'
);

INSERT INTO `company_feature_overrides` (`companyId`, `featureKey`, `enabled`, `reason`)
SELECT o.`companyId`, 'visitCheckIn', o.`enabled`, 'Backfill: check-in/out alinhado a lojas e roteiros'
FROM `company_feature_overrides` o
WHERE o.`featureKey` = 'fieldOperations'
  AND NOT EXISTS (
    SELECT 1 FROM `company_feature_overrides` x
    WHERE x.`companyId` = o.`companyId` AND x.`featureKey` = 'visitCheckIn'
  );
