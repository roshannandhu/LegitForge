-- Synthetic content in isolated LOCAL preflight bindings only. Never run remotely.
INSERT OR IGNORE INTO projects(id,slug,title,client_type,category,summary,is_published,is_featured,status_stamp)
VALUES ('preflight-project','preflight-example','Preview build','Local preview fixture','static','Synthetic work for the release checks',1,1,'none');
INSERT OR IGNORE INTO team_members(id,slug,name,role,id_code,bio,skills,tools)
VALUES ('preflight-maker-one','preflight-maker-one','Preview Maker One','Developer','LF-PF-001','Synthetic member for local release checks','["Next.js"]','["Cloudflare"]');
INSERT OR IGNORE INTO team_members(id,slug,name,role,id_code,bio,skills,tools)
VALUES ('preflight-maker-two','preflight-maker-two','Preview Maker Two','Developer','LF-PF-002','Synthetic member for local release checks','["Automation"]','["n8n"]');
